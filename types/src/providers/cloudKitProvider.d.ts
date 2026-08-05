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
export type CloudEncryptionKeyFile = import("../cloudBackup.js").CloudEncryptionKeyFile;
export type CloudProvider = import("../cloudBackup.js").CloudProvider;
/**
 * CloudKit Web Services credentials supplied by the caller.
 * The app obtains these via CloudKit JS / native CloudKit sign-in.
 */
export type CloudKitAuthContext = {
    /**
     * - API token from the CloudKit Dashboard (web services).
     */
    apiToken: string;
    /**
     * - User web auth token for private database access.
     */
    webAuthToken: string;
};
/**
 * Config for {@link CloudKitProvider}.
 */
export type CloudKitConfig = {
    /**
     * - CloudKit container identifier, e.g. `iCloud.com.example.app`.
     */
    containerIdentifier: string;
    /**
     * - CloudKit environment.
     */
    environment: "development" | "production";
    /**
     * - Custom zone name. Default: `_defaultZone`.
     */
    zoneName?: string;
    /**
     * - Stable record name for the backup. Default: `wallet_backup_key`.
     */
    recordName?: string;
    /**
     * - CloudKit record type. Default: `WalletBackup`.
     */
    recordType?: string;
    /**
     * - The user's cloud email — stored inside the backup record for traceability.
     */
    cloudEmail?: string;
    /**
     * - Returns fresh CloudKit web auth credentials before each API call.
     */
    getCloudKitAuth: () => Promise<CloudKitAuthContext>;
    /**
     * - Max number of record fetch retries during download. Default: `10`.
     */
    maxSyncRetries?: number;
    /**
     * - Delay in ms between fetch retries during download. Default: `1000`.
     */
    syncRetryDelayMs?: number;
    /**
     * - Network timeout in milliseconds. Default: `30000`.
     */
    timeout?: number;
};
