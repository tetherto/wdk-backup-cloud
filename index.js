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
 * Public barrel export — named exports only, no default exports.
 */

/**
 * @typedef {import('./src/cloudBackup.js').CloudEncryptionKeyFile} CloudEncryptionKeyFile
 * @typedef {import('./src/cloudBackup.js').CloudProvider} CloudProvider
 * @typedef {import('./src/providers/googleDriveProvider.js').GoogleDriveConfig} GoogleDriveConfig
 * @typedef {import('./src/providers/cloudKitProvider.js').CloudKitConfig} CloudKitConfig
 * @typedef {import('./src/providers/cloudKitProvider.js').CloudKitAuthContext} CloudKitAuthContext
 * @typedef {import('./src/errors.js').CloudErrorCode} CloudErrorCode
 */

export { CloudBackup } from './src/cloudBackup.js'

export { GoogleDriveProvider } from './src/providers/googleDriveProvider.js'
export { CloudKitProvider } from './src/providers/cloudKitProvider.js'

export {
  CloudAuthError,
  CloudStorageError,
  CloudUnavailableError,
  CloudValidationError
} from './src/errors.js'
