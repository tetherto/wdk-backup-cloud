/**
 * @typedef {import('./types.js').CloudProvider} CloudProvider
 * @typedef {import('./types.js').CloudEncryptionKeyFile} CloudEncryptionKeyFile
 */
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
export type CloudProvider = import("./types.js").CloudProvider;
export type CloudEncryptionKeyFile = import("./types.js").CloudEncryptionKeyFile;
