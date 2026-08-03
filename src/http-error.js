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
 * Internal HTTP/network error carrying a status code when available.
 * Not part of the public API — providers map this to typed Cloud* errors.
 *
 * @internal
 */
export class CloudHttpError extends Error {
  /**
   * @param {string} message
   * @param {number | null} [status]
   * @param {string} [detail]
   */
  constructor (message, status = null, detail = '') {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'CloudHttpError'
    /** @type {number | null} */
    this.status = status
    /** @type {string} */
    this.detail = detail
  }
}
