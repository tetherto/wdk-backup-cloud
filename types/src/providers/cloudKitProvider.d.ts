/**
 * @implements {CloudProvider}
 */
export class CloudKitProvider implements CloudProvider {
    /**
     * @param {CloudKitConfig} config - Provider configuration.
     * @throws {CloudValidationError} if `maxSyncRetries`, `syncRetryDelayMs`, or `timeout` are out of range.
     */
    constructor(config: CloudKitConfig);
    /** @private */
    private _containerIdentifier;
    /** @private */
    private _environment;
    /** @private */
    private _zoneName;
    /** @private */
    private _recordName;
    /** @private */
    private _recordType;
    /** @private */
    private _cloudEmail;
    /** @private */
    private _getCloudKitAuth;
    /** @private */
    private _fetchFn;
    /** @private */
    private _maxSyncRetries;
    /** @private */
    private _syncRetryDelayMs;
    /** @private */
    private _timeoutMs;
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
    upload(encryptedKey: string): Promise<CloudEncryptionKeyFile>;
    /**
     * Retrieve the stored backup record from CloudKit, retrying transient
     * failures up to `maxSyncRetries` times.
     *
     * @returns {Promise<CloudEncryptionKeyFile | null>} The backup payload, or `null` if none exists.
     * @throws {CloudAuthError} if the CloudKit user is not signed in.
     * @throws {CloudUnavailableError} if CloudKit is unreachable.
     * @throws {CloudStorageError} if the read fails or the record is malformed.
     */
    download(): Promise<CloudEncryptionKeyFile | null>;
    /**
     * Permanently delete the backup record from CloudKit. Idempotent — a
     * missing record is treated as success.
     *
     * @returns {Promise<void>}
     * @throws {CloudAuthError} if the CloudKit user is not signed in.
     * @throws {CloudUnavailableError} if CloudKit is unreachable.
     * @throws {CloudStorageError} if the record lacks a `recordChangeTag` or the delete fails.
     */
    delete(): Promise<void>;
    /**
     * Lightweight probe that checks whether CloudKit is reachable and the
     * user is authenticated.
     *
     * @returns {Promise<boolean>} `true` if available, `false` otherwise (never throws).
     */
    isAvailable(): Promise<boolean>;
    /**
     * Check whether a backup record exists without returning its content.
     *
     * @returns {Promise<boolean>} `true` if a backup exists, `false` otherwise (never throws).
     */
    exists(): Promise<boolean>;
    /** @private */
    private _databaseUrl;
    /** @private */
    private _zoneId;
    /** @private */
    private _cloudKitRequest;
    /** @private */
    private _probeCloudKit;
    /** @private */
    private _lookupRecord;
    /** @private */
    private _recordExists;
    /** @private */
    private _saveRecord;
    /** @private */
    private _deleteRecord;
    /** @private */
    private _recordToPayload;
    /** @private */
    private _httpError;
    /** @private */
    private _assertAvailable;
    /** @private */
    private _isAuthError;
    /** @private */
    private _mapError;
}
export type CloudEncryptionKeyFile = import("../types.js").CloudEncryptionKeyFile;
export type CloudKitAuthContext = import("../types.js").CloudKitAuthContext;
export type CloudProvider = import("../types.js").CloudProvider;
export type CloudKitConfig = import("../types.js").CloudKitConfig;
export type CloudKitFieldValue = {
    value?: string | number;
};
/**
 * CloudKit record shape (subset of fields we care about).
 */
export type CloudKitRecord = {
    recordName?: string;
    recordType?: string;
    recordChangeTag?: string;
    reason?: string;
    fields?: Record<string, CloudKitFieldValue>;
};
