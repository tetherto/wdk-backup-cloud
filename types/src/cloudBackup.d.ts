export class CloudBackup {
    /**
     * @param {CloudProvider} provider
     */
    constructor(provider: CloudProvider);
    /** @private */
    private _provider;
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
    uploadEncryptedKey(key: string): Promise<CloudEncryptionKeyFile>;
    /**
     * Download the encrypted master key from cloud storage.
     *
     * @returns {Promise<CloudEncryptionKeyFile | null>} The encrypted key file, or `null` if no backup exists yet.
     * @throws {CloudUnavailableError} if the cloud service is unreachable.
     * @throws {CloudAuthError} if credentials are invalid.
     * @throws {CloudStorageError} if the read fails.
     */
    downloadEncryptedKey(): Promise<CloudEncryptionKeyFile | null>;
    /**
     * Permanently delete the cloud backup.
     * Idempotent — safe to call even when no backup exists.
     *
     * @returns {Promise<void>}
     * @throws {CloudUnavailableError} if the cloud service is unreachable.
     * @throws {CloudAuthError} if credentials are invalid.
     * @throws {CloudStorageError} if the delete fails.
     */
    deleteBackup(): Promise<void>;
    /**
     * Check whether the cloud provider is accessible right now.
     *
     * @returns {Promise<boolean>} `true` if available, `false` otherwise (never throws).
     */
    isAvailable(): Promise<boolean>;
    /**
     * Check whether a backup file exists in cloud storage.
     * Does not download the content — lightweight existence check.
     *
     * @returns {Promise<boolean>} `true` if the backup file exists, `false` otherwise (never throws).
     */
    exists(): Promise<boolean>;
    /** @private */
    private _validateKey;
}
/**
 * The JSON blob written to cloud storage by every provider.
 */
export type CloudEncryptionKeyFile = {
    /**
     * - The encrypted wallet master key.
     */
    encryptionKey: string;
    /**
     * - ISO-8601 UTC timestamp when the backup was saved.
     */
    savedAt: string;
    /**
     * - Cloud user email that owns this backup.
     */
    cloudEmail: string;
};
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
 */
export type CloudProvider = {
    upload: (encryptedKey: string) => Promise<CloudEncryptionKeyFile>;
    download: () => Promise<CloudEncryptionKeyFile | null>;
    delete: () => Promise<void>;
    isAvailable: () => Promise<boolean>;
    exists: () => Promise<boolean>;
};
