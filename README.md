# @tetherto/wdk-backup-cloud

Cloud backup SDK for wallet apps. Stores an encrypted master key in **Google Drive** (`appDataFolder`) or **CloudKit** (private database) via a clean provider abstraction.

---

## Installation

```bash
npm install @tetherto/wdk-backup-cloud
```

---

## Requirements

| Platform | Cloud Target | Requirement |
| -------- | ------------ | ----------- |
| Any      | Google Drive | OAuth2 access token with `drive.appdata` scope |
| iOS      | CloudKit     | CloudKit container + web auth token from your app |

**This SDK performs NO OAuth flows.** The caller supplies credentials.

### Runtime compatibility

Runs on:

- Node 18+
- React Native (Hermes)
- Bare

---

## Quick Start

### Google Drive

```js
import {
  CloudBackup,
  GoogleDriveProvider
} from '@tetherto/wdk-backup-cloud'

const provider = new GoogleDriveProvider({ accessToken: '<your_token>' })
const cloud = new CloudBackup(provider)

await cloud.uploadEncryptedKey(encryptedKey)
const backup = await cloud.downloadEncryptedKey() // CloudEncryptionKeyFile | null
```

### CloudKit

```js
import {
  CloudBackup,
  CloudKitProvider
} from '@tetherto/wdk-backup-cloud'

const provider = new CloudKitProvider({
  containerIdentifier: 'iCloud.com.example.wallet',
  environment: 'production',
  getCloudKitAuth: async () => ({
    apiToken: '<cloudkit_api_token>',
    webAuthToken: '<user_web_auth_token>'
  })
})

const cloud = new CloudBackup(provider)
await cloud.uploadEncryptedKey(encryptedKey)
```

---

## CloudKit setup (integrators)

1. Enable **CloudKit** on your app in Apple Developer.
2. Create a record type `WalletBackup` (or customize via `recordType` config) with fields:
   - `encryptionKey` (String)
   - `savedAt` (String)
   - `cloudEmail` (String)
3. Deploy schema to production.
4. Enable **CloudKit web services** and obtain an API token.
5. Wire `getCloudKitAuth()` to return fresh `apiToken` + `webAuthToken` from your app's CloudKit sign-in flow.

---

## API Reference

### `GoogleDriveProvider`

`GoogleDriveConfig`:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `accessToken` | `string` | Static OAuth2 token (optional) |
| `getAccessToken` | `() => Promise<string>` | Fresh token per request (optional) |
| `filePath` | `string` | Default: `wallet_backup_key.json` |
| `cloudEmail` | `string` | Stored inside the backup file |
| `timeout` | `number` | Default: `30000` |

- File stored in Google Drive `appDataFolder`
- Provide `accessToken` **or** `getAccessToken` (callback wins if both are set)

### `CloudKitProvider`

`CloudKitConfig`:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `containerIdentifier` | `string` | Required |
| `environment` | `'development' \| 'production'` | Required |
| `zoneName` | `string` | Default: `_defaultZone` |
| `recordName` | `string` | Default: `wallet_backup_key` |
| `recordType` | `string` | Default: `WalletBackup` |
| `cloudEmail` | `string` | Stored inside the backup record |
| `getCloudKitAuth` | `() => Promise<CloudKitAuthContext>` | Required |
| `maxSyncRetries` | `number` | Default: `10` |
| `syncRetryDelayMs` | `number` | Default: `1000` |
| `timeout` | `number` | Default: `30000` |

### `CloudBackup`

| Method | Description |
| ------ | ----------- |
| `uploadEncryptedKey(key)` | Validate + upload |
| `downloadEncryptedKey()` | Download or `null` |
| `deleteBackup()` | Idempotent delete |
| `isAvailable()` | Lightweight probe |
| `exists()` | Existence check without download |

---

## Stored payload

Both providers use the same `CloudEncryptionKeyFile` shape:

```json
{
  "encryptionKey": "<encrypted_wallet_master_key>",
  "savedAt": "2026-02-25T00:00:00.000Z",
  "cloudEmail": "user@example.com"
}
```

---

## Security

- Never logs encrypted keys or auth tokens
- No local persistence — in-request lifecycle only
- No OAuth flows in the SDK
- CloudKit uses the **private** database only
- Error messages must not include `Authorization` headers or token values

---

## Build

```bash
npm run lint
npm run build:types
npm test
npm run test:coverage
```

---

## License

Apache-2.0
