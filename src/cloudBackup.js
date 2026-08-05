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
 * CloudBackup — public facade that wraps any CloudProvider.
 *
 * Responsibilities:
 *  - Validate inputs (non-empty key)
 *  - Delegate to the injected provider
 *  - Never log sensitive data
 *  - Normalise provider errors (re-throw as-is, since providers already use
 *    our typed error classes)
 */

import { CloudValidationError } from './errors.js'

/**
 * The JSON blob written to cloud storage by every provider.
 *
 * @typedef {Object} CloudEncryptionKeyFile
 * @property {string} encryptionKey - The encrypted wallet master key.
 * @property {string} savedAt - ISO-8601 UTC timestamp when the backup was saved.
 * @property {string} cloudEmail - Cloud user email that owns this backup.
 */

/**
 * Abstraction over any cloud storage backend.
 * Implementations should expose cloud operations without persisting backup
 * data locally inside this SDK.
 *
 * - `upload` stores `encryptedKey`; if a backup already exists it MUST be
 *   overwritten.
 * - `download` retrieves the stored backup, or `null` if none exists yet.
 * - `delete` permanently removes the backup and MUST be idempotent.
 * - `isAvailable` is a lightweight probe — not a full upload/download.
 * - `exists` reports whether a backup file exists without downloading it.
 *
 * @typedef {Object} CloudProvider
 * @property {(encryptedKey: string) => Promise<CloudEncryptionKeyFile>} upload
 * @property {() => Promise<CloudEncryptionKeyFile | null>} download
 * @property {() => Promise<void>} delete
 * @property {() => Promise<boolean>} isAvailable
 * @property {() => Promise<boolean>} exists
 */

export class CloudBackup {
  /**
   * @param {CloudProvider} provider
   */
  constructor (provider) {
    /** @private */
    this._provider = provider
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Upload the encrypted master key to cloud storage.
   *
   * @param {string} key - The encrypted wallet master key (must be non-empty).
   * @returns {Promise<CloudEncryptionKeyFile>}
   * @throws {CloudValidationError} if `key` is empty or whitespace-only.
   * @throws {CloudUnavailableError} if the cloud service is unreachable.
   * @throws {CloudAuthError} if credentials are invalid.
   * @throws {CloudStorageError} if the write fails.
   */
  async uploadEncryptedKey (key) {
    this._validateKey(key)
    return await this._provider.upload(key)
  }

  /**
   * Download the encrypted master key from cloud storage.
   *
   * @returns {Promise<CloudEncryptionKeyFile | null>} The encrypted key file, or `null` if no backup exists yet.
   * @throws {CloudUnavailableError} if the cloud service is unreachable.
   * @throws {CloudAuthError} if credentials are invalid.
   * @throws {CloudStorageError} if the read fails.
   */
  async downloadEncryptedKey () {
    return await this._provider.download()
  }

  /**
   * Permanently delete the cloud backup.
   * Idempotent — safe to call even when no backup exists.
   *
   * @returns {Promise<void>}
   * @throws {CloudUnavailableError} if the cloud service is unreachable.
   * @throws {CloudAuthError} if credentials are invalid.
   * @throws {CloudStorageError} if the delete fails.
   */
  async deleteBackup () {
    return await this._provider.delete()
  }

  /**
   * Check whether the cloud provider is accessible right now.
   *
   * @returns {Promise<boolean>} `true` if available, `false` otherwise (never throws).
   */
  async isAvailable () {
    return await this._provider.isAvailable()
  }

  /**
   * Check whether a backup file exists in cloud storage.
   * Does not download the content — lightweight existence check.
   *
   * @returns {Promise<boolean>} `true` if the backup file exists, `false` otherwise (never throws).
   */
  async exists () {
    return await this._provider.exists()
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** @private */
  _validateKey (key) {
    if (key.trim().length === 0) {
      throw new CloudValidationError(
        'Encrypted key must be a non-empty string'
      )
    }
  }
}
