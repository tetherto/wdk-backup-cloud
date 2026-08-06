/**
 * The cloud service is unreachable or not enabled on the device
 * (e.g., CloudKit unavailable, no network connectivity).
 */
export class CloudUnavailableError extends CloudError {
    /**
     * @param {string} [message]
     * @param {unknown} [cause]
     */
    constructor(message?: string, cause?: unknown);
    /** @type {CloudErrorCode} */
    code: CloudErrorCode;
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
    constructor(message?: string, cause?: unknown);
    /** @type {CloudErrorCode} */
    code: CloudErrorCode;
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
    constructor(message?: string, cause?: unknown);
    /** @type {CloudErrorCode} */
    code: CloudErrorCode;
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
    constructor(message?: string, cause?: unknown);
    /** @type {CloudErrorCode} */
    code: CloudErrorCode;
}
export type CloudErrorCode = "CLOUD_UNAVAILABLE" | "CLOUD_AUTH_ERROR" | "CLOUD_STORAGE_ERROR" | "CLOUD_VALIDATION_ERROR";
/**
 * Typed error hierarchy — all errors carry a machine-readable `code`
 * discriminant so callers can branch without instanceof chains.
 *
 * Security: error messages MUST NOT contain encrypted key material.
 */
/**
 * @typedef {'CLOUD_UNAVAILABLE' | 'CLOUD_AUTH_ERROR' | 'CLOUD_STORAGE_ERROR' | 'CLOUD_VALIDATION_ERROR'} CloudErrorCode
 */
declare class CloudError extends Error {
    /**
     * @param {string} message
     * @param {unknown} [cause]
     */
    constructor(message: string, cause?: unknown);
}
export {};
