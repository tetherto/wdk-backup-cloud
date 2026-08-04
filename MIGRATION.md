# Migrating from `@tetherto/wdk-backup-cloud-react-native`

This guide covers moving from the legacy `@tetherto/wdk-backup-cloud-react-native`
package to `@tetherto/wdk-backup-cloud`.

The new package keeps the same public surface (`CloudBackup` + a provider
abstraction) but removes the React Native dependency and changes the Apple
storage backend from **iCloud Drive** to **CloudKit**. That backend change is
the part that needs real migration work; almost everything else is a drop-in.

> **TL;DR**
>
> - **Google Drive users:** effectively no migration — same store, same file. Just update the API.
> - **iOS / Apple users:** the store changes from iCloud Drive to CloudKit. These are **separate stores**, so existing backups must be copied over per-user, on-device. There is no server-side or in-place migration.
> - The old package is **deprecated but still supported** — teams can migrate on their own schedule.

---

## 1. What changed

| Aspect | Legacy (`…-react-native`) | New (`wdk-backup-cloud`) |
| --- | --- | --- |
| Runtime dependency | `react-native-cloud-storage` (native module) | None — uses global `fetch` |
| Apple backend | **iCloud Drive** file (`AppData` scope) | **CloudKit** private DB record |
| Google backend | Google Drive `appDataFolder` (via native module) | Google Drive `appDataFolder` (via Drive REST API v3) |
| Apple auth | Implicit (device/native) | Caller supplies `{ apiToken, webAuthToken }` via `getCloudKitAuth()` |
| Google auth | `accessToken` | `accessToken` **or** `getAccessToken()` callback |
| `uploadEncryptedKey` | `(key, metadata)` | `(key)` — metadata argument removed |
| Stored payload | `{ encryptionKey, savedAt, platform, version, cloudEmail }` | `{ encryptionKey, savedAt, cloudEmail }` |
| Provider class | `ICloudProvider` | `CloudKitProvider` |

The `CloudBackup` methods (`uploadEncryptedKey`, `downloadEncryptedKey`,
`deleteBackup`, `isAvailable`, `exists`) and the error hierarchy
(`CloudValidationError`, `CloudAuthError`, `CloudUnavailableError`,
`CloudStorageError`) are unchanged.

---

## 2. Compatibility at a glance

| Your platform | Do you need to migrate data? |
| --- | --- |
| **Google Drive only** | **No.** Same `appDataFolder` + same `wallet_backup_key.json`. Old backups are readable by the new code as-is (extra `platform`/`version` fields are ignored). |
| **iOS / iCloud** | **Yes.** iCloud Drive and CloudKit are different stores; old backups are invisible to the new `CloudKitProvider` until copied. |

---

## 3. Google Drive: (almost) nothing to do

Both versions store the backup in Drive's `appDataFolder` under the same default
filename (`wallet_backup_key.json`), and the new parser only requires
`encryptionKey`, `savedAt`, and `cloudEmail` (ignoring the dropped
`platform`/`version` fields). So an existing Drive backup written by the legacy
package is read correctly by the new one.

Action items:

1. Update the import and the `uploadEncryptedKey` call (drop the metadata arg — see §5).
2. Confirm you use the same `filePath` if you ever customized it.

```js
import { CloudBackup, GoogleDriveProvider } from '@tetherto/wdk-backup-cloud'

const cloud = new CloudBackup(new GoogleDriveProvider({ accessToken }))
await cloud.uploadEncryptedKey(encryptedKey) // was: uploadEncryptedKey(key, { version: 1 })
```

---

## 4. iOS: iCloud Drive → CloudKit (the real migration)

### Why there's no automatic path

The legacy package stored the backup as a **file in the app's iCloud Drive
container**. The new package stores it as a **record in the app's CloudKit
private database**. CloudKit's API cannot see iCloud Drive files and vice-versa,
so:

- An existing iOS user's backup is **not visible** to the new `CloudKitProvider`.
- The backups are per-user, encrypted, and reachable only with that user's own
  credentials on their own device — so a **central/server-side migration is not
  possible**. Migration must run **client-side, per user, on device**.
- The new SDK deliberately dropped the React Native dependency, so it **cannot
  read the legacy iCloud Drive file itself**. The copy step must be done in the
  app layer (or with the old package / a thin shim) during a transition window.

### Recommended approach: lazy write-through migration

On first launch after adopting the new SDK, migrate on demand:

1. Try to read from CloudKit with the new provider.
2. If nothing is found, read the legacy iCloud Drive file using the **old
   package** (or `react-native-cloud-storage` directly).
3. If a legacy backup exists, upload it into CloudKit with the new provider.
4. **Verify** the CloudKit write succeeded before removing anything. Keep the
   legacy file for a grace period; clean it up in a later release if desired.

Example:

```js
import { CloudBackup, CloudKitProvider } from '@tetherto/wdk-backup-cloud'
// Legacy read path — only needed during the transition window:
import { CloudBackup as LegacyBackup, ICloudProvider } from '@tetherto/wdk-backup-cloud-react-native'

async function migrateAppleBackupIfNeeded ({ getCloudKitAuth, containerIdentifier }) {
  const cloud = new CloudBackup(
    new CloudKitProvider({ containerIdentifier, environment: 'production', getCloudKitAuth })
  )

  // 1. Already migrated? Nothing to do.
  if (await cloud.exists()) return { migrated: false, reason: 'already-in-cloudkit' }

  // 2. Look for a legacy iCloud Drive backup.
  const legacy = new LegacyBackup(new ICloudProvider())
  const legacyBackup = await legacy.downloadEncryptedKey()
  if (legacyBackup === null) return { migrated: false, reason: 'no-legacy-backup' }

  // 3. Copy it into CloudKit. Note: `savedAt` becomes "now" and `cloudEmail`
  //    comes from the provider config — the original values are not carried over.
  await cloud.uploadEncryptedKey(legacyBackup.encryptionKey)

  // 4. Verify before trusting the migration. Leave the legacy file in place for now.
  const verified = await cloud.exists()
  return { migrated: verified, reason: verified ? 'ok' : 'verify-failed' }
}
```

### Alternative: dual-read fallback

Check CloudKit first and fall back to a legacy iCloud read on a miss, without an
explicit copy. Simpler, but it keeps the React Native dependency alive
indefinitely and never consolidates the store. Treat it as a stopgap, not an end
state.

---

## 5. Code changes required (all platforms)

### 5.1 `uploadEncryptedKey` no longer takes metadata

```diff
- await cloud.uploadEncryptedKey(encryptedKey, { version: 1 })
+ await cloud.uploadEncryptedKey(encryptedKey)
```

### 5.2 Stored payload dropped `platform` and `version`

The new payload is `{ encryptionKey, savedAt, cloudEmail }`. If any consumer
relied on `version` (e.g. for schema evolution) or `platform`, decide as a team
whether to re-introduce a marker or accept the removal. Note there is currently
**no schema-version field** in the new format.

### 5.3 iOS provider swap

```diff
- import { CloudBackup, ICloudProvider } from '@tetherto/wdk-backup-cloud-react-native'
- const cloud = new CloudBackup(new ICloudProvider())
+ import { CloudBackup, CloudKitProvider } from '@tetherto/wdk-backup-cloud'
+ const cloud = new CloudBackup(new CloudKitProvider({
+   containerIdentifier: 'iCloud.com.example.wallet',
+   environment: 'production',
+   getCloudKitAuth: async () => ({ apiToken, webAuthToken })
+ }))
```

---

## 6. React Native / native-side changes

Because the new package no longer bundles `react-native-cloud-storage`, RN apps
may need native-side work depending on their setup:

- **iOS / CloudKit:** wire up CloudKit sign-in to mint a **web auth token** (via
  CloudKit JS or a native bridge), provision the **API token**, and deploy the
  `WalletBackup` record type — none of this is handled by the SDK anymore.
- **Transition window:** if you implement the lazy write-through migration (§4),
  keep `react-native-cloud-storage` (or the old package) installed until
  migration is complete, since the new SDK can't read the legacy iCloud file.
- **Google Drive:** typically no native change — same store and token flow.
- **Cleanup:** removing `react-native-cloud-storage` afterward may require a pod
  reinstall / native rebuild.

---

## 7. CloudKit setup prerequisites (iOS integrators)

1. Enable **CloudKit** for the app in Apple Developer.
2. Create the record type (default `WalletBackup`, override via `recordType`)
   with String fields: `encryptionKey`, `savedAt`, `cloudEmail`.
3. **Deploy the schema to production.**
4. Enable **CloudKit web services** and obtain an API token.
5. Implement CloudKit sign-in in the app and wire `getCloudKitAuth()` to return
   fresh `{ apiToken, webAuthToken }` before each call.

> This SDK performs **no** OAuth / sign-in flows for either Google or Apple —
> the app owns credential management. If your migration needs silent re-auth to
> write to CloudKit on the user's behalf, the sign-in work is a prerequisite.

---

## 8. Safety notes

- Migration is idempotent — CloudKit writes use `forceUpdate`, so re-running is safe.
- Never delete the legacy backup until the CloudKit write is verified.
- Nothing is logged that contains the encrypted key or any auth token.

---

## 9. Gotchas & edge cases

- **Multi-device rollout:** a user may run the old app on one device and the new one on another during the transition. Migration runs per-device and is idempotent (`exists()` is checked first), so each device migrates itself on first launch.
- **CloudKit dev vs. production:** records written in `development` are invisible in `production`. Migrate and test against the same environment you ship.
- **Timestamp & email aren't carried over:** the migrated record's `savedAt` is set to migration time and `cloudEmail` comes from the new config. Preserve them explicitly if your UI depends on them.
- **Rollback:** keeping the legacy iCloud file lets an older app version keep working if you need to roll back — clean it up only once migration is proven.
- **No re-encryption:** `encryptionKey` is an opaque blob copied verbatim, so the user's keys/passphrase are unaffected.
