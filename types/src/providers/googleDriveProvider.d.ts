/**
 * @implements {CloudProvider}
 */
export class GoogleDriveProvider implements CloudProvider {
    /**
     * @param {GoogleDriveConfig} config - Provider configuration.
     * @throws {CloudValidationError} if neither `accessToken` nor `getAccessToken` is provided, or if `timeout` is not a positive number.
     */
    constructor(config: GoogleDriveConfig);
    /** @private */
    private _getAccessToken;
    /** @private */
    private _filePath;
    /** @private */
    private _cloudEmail;
    /** @private */
    private _timeoutMs;
    /** @private */
    private _fetchFn;
    /**
     * Store the encrypted master key in Google Drive `appDataFolder`,
     * overwriting any existing backup, then verify the write succeeded.
     *
     * @param {string} encryptedKey - The encrypted wallet master key.
     * @returns {Promise<CloudEncryptionKeyFile>} The stored backup payload.
     * @throws {CloudAuthError} if the access token is invalid or expired.
     * @throws {CloudUnavailableError} if Google Drive is unreachable.
     * @throws {CloudStorageError} if the write fails or cannot be verified.
     */
    upload(encryptedKey: string): Promise<CloudEncryptionKeyFile>;
    /**
     * Retrieve the stored backup from Google Drive.
     *
     * @returns {Promise<CloudEncryptionKeyFile | null>} The backup payload, or `null` if none exists.
     * @throws {CloudAuthError} if the access token is invalid or expired.
     * @throws {CloudUnavailableError} if Google Drive is unreachable.
     * @throws {CloudStorageError} if the read fails or the payload is malformed.
     */
    download(): Promise<CloudEncryptionKeyFile | null>;
    /**
     * Permanently delete the backup from Google Drive. Idempotent — a missing
     * file is treated as success.
     *
     * @returns {Promise<void>}
     * @throws {CloudAuthError} if the access token is invalid or expired.
     * @throws {CloudUnavailableError} if Google Drive is unreachable.
     * @throws {CloudStorageError} if the delete fails.
     */
    delete(): Promise<void>;
    /**
     * Lightweight probe that checks whether Google Drive is reachable.
     *
     * @returns {Promise<boolean>} `true` if reachable, `false` otherwise (never throws).
     */
    isAvailable(): Promise<boolean>;
    /**
     * Check whether a backup file exists without downloading its content.
     *
     * @returns {Promise<boolean>} `true` if a backup exists, `false` otherwise (never throws).
     */
    exists(): Promise<boolean>;
    /** @private */
    private _escapeDriveQueryValue;
    /** @private */
    private _findFileId;
    /** @private */
    private _fileExists;
    /** @private */
    private _createFile;
    /** @private */
    private _updateFile;
    /** @private */
    private _readFileContent;
    /** @private */
    private _deleteFile;
    /** @private */
    private _driveRequest;
    /** @private */
    private _httpError;
    /** @private */
    private _isNotFoundError;
    /** @private */
    private _mapError;
    /** @private */
    private _parsePayload;
}
export type CloudEncryptionKeyFile = import("../types.js").CloudEncryptionKeyFile;
export type CloudProvider = import("../types.js").CloudProvider;
export type GoogleDriveConfig = import("../types.js").GoogleDriveConfig;
