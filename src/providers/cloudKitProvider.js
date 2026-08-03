// Copyright 2026 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * CloudKitProvider — stores the encrypted master key in the user's CloudKit
 * private database via CloudKit Web Services.
 *
 * Design constraints:
 *  - Uses CloudKit private database records (not legacy iCloud Drive files).
 *  - Caller supplies CloudKit web auth via `getCloudKitAuth`.
 *  - Payload mirrors `CloudEncryptionKeyFile`.
 *  - Never logs the encrypted key material or auth tokens.
 */

import {
  CloudAuthError,
  CloudStorageError,
  CloudUnavailableError,
  CloudValidationError
} from '../errors.js'
import { CloudHttpError } from '../http-error.js'

/**
 * @typedef {import('../types.js').CloudEncryptionKeyFile} CloudEncryptionKeyFile
 * @typedef {import('../types.js').CloudKitAuthContext} CloudKitAuthContext
 * @typedef {import('../types.js').CloudProvider} CloudProvider
 * @typedef {import('../types.js').CloudKitConfig} CloudKitConfig
 */

/**
 * @internal
 * @typedef {Object} CloudKitFieldValue
 * @property {string | number} [value]
 */

/**
 * CloudKit record shape (subset of fields we care about).
 *
 * @internal
 * @typedef {Object} CloudKitRecord
 * @property {string} [recordName]
 * @property {string} [recordType]
 * @property {string} [recordChangeTag]
 * @property {string} [reason]
 * @property {Record<string, CloudKitFieldValue>} [fields]
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLOUDKIT_API_BASE = 'https://api.apple-cloudkit.com/database/1'
const DEFAULT_ZONE_NAME = '_defaultZone'
const DEFAULT_RECORD_NAME = 'wallet_backup_key'
const DEFAULT_RECORD_TYPE = 'WalletBackup'
const DEFAULT_MAX_SYNC_RETRIES = 10
const DEFAULT_SYNC_RETRY_DELAY_MS = 1000
const DEFAULT_TIMEOUT_MS = 30000

const BACKUP_FIELD_KEYS = ['encryptionKey', 'savedAt', 'cloudEmail']

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * @implements {CloudProvider}
 */
export class CloudKitProvider {
  /**
   * @param {CloudKitConfig} config - Provider configuration.
   * @throws {CloudValidationError} if `maxSyncRetries`, `syncRetryDelayMs`, or `timeout` are out of range.
   */
  constructor (config) {
    /** @private */
    this._containerIdentifier = config.containerIdentifier
    /** @private */
    this._environment = config.environment
    /** @private */
    this._zoneName = config.zoneName ?? DEFAULT_ZONE_NAME
    /** @private */
    this._recordName = config.recordName ?? DEFAULT_RECORD_NAME
    /** @private */
    this._recordType = config.recordType ?? DEFAULT_RECORD_TYPE
    /** @private */
    this._cloudEmail = config.cloudEmail ?? ''
    /** @private */
    this._getCloudKitAuth = config.getCloudKitAuth
    /** @private */
    this._fetchFn = globalThis.fetch.bind(globalThis)
    /** @private */
    this._maxSyncRetries = config.maxSyncRetries ?? DEFAULT_MAX_SYNC_RETRIES
    /** @private */
    this._syncRetryDelayMs = config.syncRetryDelayMs ?? DEFAULT_SYNC_RETRY_DELAY_MS
    /** @private */
    this._timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS

    if (!Number.isInteger(this._maxSyncRetries) || this._maxSyncRetries < 1) {
      throw new CloudValidationError(
        'CloudKitConfig.maxSyncRetries must be an integer >= 1'
      )
    }

    if (!Number.isFinite(this._syncRetryDelayMs) || this._syncRetryDelayMs < 0) {
      throw new CloudValidationError(
        'CloudKitConfig.syncRetryDelayMs must be a number >= 0'
      )
    }

    if (!Number.isFinite(this._timeoutMs) || this._timeoutMs <= 0) {
      throw new CloudValidationError(
        'CloudKitConfig.timeout must be a number greater than 0'
      )
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Store the encrypted master key in the CloudKit private database,
   * overwriting any existing record, then verify the write succeeded.
   *
   * @param {string} encryptedKey - The encrypted wallet master key.
   * @returns {Promise<CloudEncryptionKeyFile>} The stored backup payload.
   * @throws {CloudAuthError} if the CloudKit user is not signed in.
   * @throws {CloudUnavailableError} if CloudKit is unreachable.
   * @throws {CloudStorageError} if the write fails, the quota is exceeded, or it cannot be verified.
   */
  async upload (encryptedKey) {
    await this._assertAvailable()

    /** @type {CloudEncryptionKeyFile} */
    const payload = {
      encryptionKey: encryptedKey,
      savedAt: new Date().toISOString(),
      cloudEmail: this._cloudEmail
    }

    try {
      await this._saveRecord(payload)
    } catch (cause) {
      throw this._mapError(cause, 'Failed to write backup to CloudKit')
    }

    try {
      const verified = await this._recordExists()
      if (!verified) {
        throw new CloudStorageError(
          'CloudKit backup failed: record not found after write'
        )
      }
      return payload
    } catch (cause) {
      if (cause instanceof CloudStorageError) throw cause
      throw this._mapError(cause, 'Failed to verify CloudKit backup')
    }
  }

  /**
   * Retrieve the stored backup record from CloudKit, retrying transient
   * failures up to `maxSyncRetries` times.
   *
   * @returns {Promise<CloudEncryptionKeyFile | null>} The backup payload, or `null` if none exists.
   * @throws {CloudAuthError} if the CloudKit user is not signed in.
   * @throws {CloudUnavailableError} if CloudKit is unreachable.
   * @throws {CloudStorageError} if the read fails or the record is malformed.
   */
  async download () {
    await this._assertAvailable()

    const exists = await this._recordExists()
    if (!exists) return null

    /** @type {unknown} */
    let lastError
    for (let attempt = 1; attempt <= this._maxSyncRetries; attempt++) {
      try {
        const record = await this._lookupRecord()
        if (!record) return null
        return this._recordToPayload(record)
      } catch (cause) {
        lastError = cause
        if (cause instanceof CloudStorageError) throw cause
        if (this._isAuthError(cause)) {
          throw this._mapError(cause, 'Failed to read backup from CloudKit')
        }
        if (attempt < this._maxSyncRetries) {
          await new Promise((resolve) => setTimeout(resolve, this._syncRetryDelayMs))
        }
      }
    }

    throw this._mapError(
      lastError,
      `Failed to read backup from CloudKit after ${this._maxSyncRetries} attempts`
    )
  }

  /**
   * Permanently delete the backup record from CloudKit. Idempotent — a
   * missing record is treated as success.
   *
   * @returns {Promise<void>}
   * @throws {CloudAuthError} if the CloudKit user is not signed in.
   * @throws {CloudUnavailableError} if CloudKit is unreachable.
   * @throws {CloudStorageError} if the record lacks a `recordChangeTag` or the delete fails.
   */
  async delete () {
    await this._assertAvailable()

    const record = await this._lookupRecord()
    if (!record) return

    try {
      await this._deleteRecord(record)
    } catch (cause) {
      if (
        cause instanceof CloudStorageError ||
        cause instanceof CloudAuthError ||
        cause instanceof CloudUnavailableError
      ) {
        throw cause
      }
      throw this._mapError(cause, 'Failed to delete backup from CloudKit')
    }
  }

  /**
   * Lightweight probe that checks whether CloudKit is reachable and the
   * user is authenticated.
   *
   * @returns {Promise<boolean>} `true` if available, `false` otherwise (never throws).
   */
  async isAvailable () {
    try {
      await this._probeCloudKit()
      return true
    } catch {
      return false
    }
  }

  /**
   * Check whether a backup record exists without returning its content.
   *
   * @returns {Promise<boolean>} `true` if a backup exists, `false` otherwise (never throws).
   */
  async exists () {
    try {
      const available = await this.isAvailable()
      if (!available) return false
      return await this._recordExists()
    } catch {
      return false
    }
  }

  // -------------------------------------------------------------------------
  // CloudKit API helpers
  // -------------------------------------------------------------------------

  /** @private */
  _databaseUrl (path, apiToken) {
    const base = `${CLOUDKIT_API_BASE}/${encodeURIComponent(this._containerIdentifier)}/${this._environment}/private/${path}`
    return `${base}?ckAPIToken=${encodeURIComponent(apiToken)}`
  }

  /** @private */
  _zoneId () {
    return { zoneName: this._zoneName }
  }

  /** @private */
  async _cloudKitRequest (path, auth, body, method = 'POST') {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this._timeoutMs)

    try {
      return await this._fetchFn(this._databaseUrl(path, auth.apiToken), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Apple-CloudKit-Web-Auth-Token': auth.webAuthToken
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw new CloudHttpError('network timeout', null)
      }
      if (cause instanceof CloudHttpError) throw cause
      throw new CloudHttpError(
        cause instanceof Error ? cause.message : String(cause),
        null
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  /** @private */
  async _probeCloudKit () {
    const auth = await this._getCloudKitAuth()
    const response = await this._cloudKitRequest('records/lookup', auth, {
      records: [
        {
          recordName: this._recordName,
          desiredKeys: [...BACKUP_FIELD_KEYS]
        }
      ],
      zoneID: this._zoneId()
    })

    if (response.status === 401 || response.status === 403) {
      throw new CloudHttpError('unauthorized', response.status)
    }

    if (!response.ok) {
      throw await this._httpError(response, 'CloudKit availability check failed')
    }
  }

  /** @private */
  async _lookupRecord () {
    const auth = await this._getCloudKitAuth()
    const response = await this._cloudKitRequest('records/lookup', auth, {
      records: [
        {
          recordName: this._recordName,
          desiredKeys: [...BACKUP_FIELD_KEYS]
        }
      ],
      zoneID: this._zoneId()
    })

    if (response.status === 401 || response.status === 403) {
      throw new CloudHttpError('unauthorized', response.status)
    }

    if (!response.ok) {
      throw await this._httpError(response, 'CloudKit record lookup failed')
    }

    const body = await response.json()
    const record = body.records?.[0]
    if (!record || record.reason === 'RECORD_NOT_FOUND') {
      return null
    }
    if (record.reason) {
      throw new CloudHttpError(record.reason, null)
    }
    return record
  }

  /** @private */
  async _recordExists () {
    const record = await this._lookupRecord()
    return record !== null
  }

  /** @private */
  async _saveRecord (payload) {
    const auth = await this._getCloudKitAuth()
    const response = await this._cloudKitRequest('records/modify', auth, {
      operations: [
        {
          operationType: 'forceUpdate',
          record: {
            recordType: this._recordType,
            recordName: this._recordName,
            fields: {
              encryptionKey: { value: payload.encryptionKey },
              savedAt: { value: payload.savedAt },
              cloudEmail: { value: payload.cloudEmail }
            }
          }
        }
      ],
      zoneID: this._zoneId()
    })

    if (response.status === 401 || response.status === 403) {
      throw new CloudHttpError('unauthorized', response.status)
    }

    if (!response.ok) {
      throw await this._httpError(response, 'CloudKit record save failed')
    }

    const body = await response.json()
    const result = body.records?.[0]
    if (result?.reason && result.reason !== 'RECORD_CHANGED') {
      throw new CloudHttpError(result.reason, null)
    }
  }

  /** @private */
  async _deleteRecord (record) {
    if (!record.recordChangeTag) {
      throw new CloudStorageError(
        'CloudKit record is missing recordChangeTag required for delete'
      )
    }

    const auth = await this._getCloudKitAuth()
    const response = await this._cloudKitRequest('records/modify', auth, {
      operations: [
        {
          operationType: 'delete',
          record: {
            recordType: this._recordType,
            recordName: this._recordName,
            recordChangeTag: record.recordChangeTag
          }
        }
      ],
      zoneID: this._zoneId()
    })

    if (response.status === 404) return

    if (response.status === 401 || response.status === 403) {
      throw new CloudHttpError('unauthorized', response.status)
    }

    if (!response.ok) {
      throw await this._httpError(response, 'CloudKit record delete failed')
    }

    // CloudKit reports per-operation failures as HTTP 200 with a `reason` on
    // the record, so inspect the body (as _saveRecord does). A missing record
    // is idempotent success; any other reason is a real failure.
    const body = await response.json()
    const result = body.records?.[0]
    if (result?.reason && result.reason !== 'RECORD_NOT_FOUND') {
      throw new CloudHttpError(result.reason, null)
    }
  }

  /** @private */
  _recordToPayload (record) {
    const fields = record.fields ?? {}
    const encryptionKey = fields.encryptionKey?.value
    const savedAt = fields.savedAt?.value
    const cloudEmail = fields.cloudEmail?.value

    if (
      typeof encryptionKey !== 'string' ||
      typeof savedAt !== 'string' ||
      typeof cloudEmail !== 'string'
    ) {
      throw new CloudStorageError(
        'CloudKit backup payload has an unexpected shape'
      )
    }

    return {
      encryptionKey,
      savedAt,
      cloudEmail
    }
  }

  /** @private */
  async _httpError (response, context) {
    let detail = ''
    try {
      const text = await response.text()
      detail = text.slice(0, 200)
    } catch {
      detail = response.statusText
    }
    return new CloudHttpError(
      `${response.status} ${context}: ${detail}`,
      response.status,
      detail
    )
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** @private */
  async _assertAvailable () {
    try {
      await this._probeCloudKit()
    } catch (cause) {
      if (this._isAuthError(cause)) {
        throw new CloudAuthError(
          'CloudKit user not signed in — authentication failed',
          cause
        )
      }
      throw new CloudUnavailableError(
        'CloudKit is not available. Ensure the user is signed in and CloudKit is enabled.',
        cause
      )
    }
  }

  /** @private */
  _isAuthError (cause) {
    if (cause instanceof CloudHttpError) {
      return cause.status === 401 || cause.status === 403
    }
    return false
  }

  /** @private */
  _mapError (cause, context) {
    if (cause instanceof CloudHttpError) {
      const status = cause.status
      const reason = cause.message.toUpperCase()

      if (status === 401 || status === 403) {
        return new CloudAuthError(
          `CloudKit user not signed in — ${context}`,
          cause
        )
      }

      if (
        reason.includes('QUOTA') ||
        cause.detail.toLowerCase().includes('quota') ||
        cause.detail.toLowerCase().includes('insufficient storage')
      ) {
        return new CloudStorageError(
          `CloudKit storage quota exceeded — ${context}`,
          cause
        )
      }

      if (
        status === null ||
        status === 429 ||
        status === 502 ||
        status === 503 ||
        status === 504
      ) {
        return new CloudUnavailableError(
          `CloudKit service unavailable — ${context}`,
          cause
        )
      }

      return new CloudStorageError(`${context}: ${cause.message}`, cause)
    }

    const msg =
      cause instanceof Error ? cause.message.toLowerCase() : String(cause)

    return new CloudStorageError(`${context}: ${msg}`, cause)
  }
}
