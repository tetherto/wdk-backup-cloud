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
 * Typed error hierarchy — all errors carry a machine-readable `code`
 * discriminant so callers can branch without instanceof chains.
 *
 * Security: error messages MUST NOT contain encrypted key material.
 */

/**
 * @typedef {'CLOUD_UNAVAILABLE' | 'CLOUD_AUTH_ERROR' | 'CLOUD_STORAGE_ERROR' | 'CLOUD_VALIDATION_ERROR'} CloudErrorCode
 */

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

class CloudError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor (message, cause) {
    super(message)
    // Fix prototype chain for transpiled classes
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    /** @type {unknown} */
    this.cause = cause
  }
}

// ---------------------------------------------------------------------------
// Concrete errors
// ---------------------------------------------------------------------------

/**
 * The cloud service is unreachable or not enabled on the device
 * (e.g., CloudKit unavailable, no network connectivity).
 */
export class CloudUnavailableError extends CloudError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor (message = 'Cloud storage is unavailable', cause) {
    super(message, cause)
    /** @type {CloudErrorCode} */
    this.code = 'CLOUD_UNAVAILABLE'
  }
}

/**
 * The caller's credentials are invalid or expired
 * (e.g., Google OAuth token revoked, CloudKit user not signed in).
 */
export class CloudAuthError extends CloudError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor (message = 'Cloud authentication failed', cause) {
    super(message, cause)
    /** @type {CloudErrorCode} */
    this.code = 'CLOUD_AUTH_ERROR'
  }
}

/**
 * A read, write, or delete operation failed at the storage layer
 * (e.g., quota exceeded, I/O error, malformed server response).
 */
export class CloudStorageError extends CloudError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor (message = 'Cloud storage operation failed', cause) {
    super(message, cause)
    /** @type {CloudErrorCode} */
    this.code = 'CLOUD_STORAGE_ERROR'
  }
}

/**
 * The caller supplied an invalid argument to the SDK
 * (e.g., empty encrypted key, invalid provider config).
 */
export class CloudValidationError extends CloudError {
  /**
   * @param {string} [message]
   * @param {unknown} [cause]
   */
  constructor (message = 'Cloud backup validation failed', cause) {
    super(message, cause)
    /** @type {CloudErrorCode} */
    this.code = 'CLOUD_VALIDATION_ERROR'
  }
}
