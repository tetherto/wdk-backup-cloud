import { jest } from '@jest/globals'
import { CloudKitProvider } from '../src/providers/cloudKitProvider.js'
import {
  CloudAuthError,
  CloudStorageError,
  CloudUnavailableError,
  CloudValidationError
} from '../src/errors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENCRYPTED_KEY = 'encrypted_master_key_hex'
const RECORD_NAME = 'wallet_backup_key'

const AUTH = {
  apiToken: 'ck-api-token',
  webAuthToken: 'ck-web-auth-token'
}

const VALID_PAYLOAD = {
  encryptionKey: ENCRYPTED_KEY,
  savedAt: '2026-02-25T00:00:00.000Z',
  cloudEmail: ''
}

const VALID_RECORD = {
  recordName: RECORD_NAME,
  recordType: 'WalletBackup',
  recordChangeTag: 'abc123change',
  fields: {
    encryptionKey: { value: ENCRYPTED_KEY },
    savedAt: { value: VALID_PAYLOAD.savedAt },
    cloudEmail: { value: '' }
  }
}

const getCloudKitAuth = jest.fn()

function makeProvider (overrides) {
  return new CloudKitProvider({
    containerIdentifier: 'iCloud.com.example.app',
    environment: 'development',
    getCloudKitAuth,
    ...overrides
  })
}

async function expectError (promise, ErrorClass, message) {
  const err = await promise.catch((e) => e)
  expect(err).toBeInstanceOf(ErrorClass)
  expect(err.message).toMatch(message)
}

function mockJson (body, status = 200) {
  fetchMock.mockResponseOnce(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function mockLookupFound () {
  mockJson({ records: [VALID_RECORD] })
}

function mockLookupNotFound () {
  mockJson({
    records: [{ recordName: RECORD_NAME, reason: 'RECORD_NOT_FOUND' }]
  })
}

function mockModifyOk () {
  mockJson({ records: [{ recordName: RECORD_NAME }] })
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.resetMocks()
  getCloudKitAuth.mockResolvedValue(AUTH)
})

describe('CloudKitProvider constructor', () => {
  it('throws when maxSyncRetries is invalid', () => {
    expect(() => makeProvider({ maxSyncRetries: 0 })).toThrow(/maxSyncRetries/)
    expect(() => makeProvider({ maxSyncRetries: 0 })).toThrow(
      CloudValidationError
    )
  })

  it('throws when timeout is invalid', () => {
    expect(() => makeProvider({ timeout: 0 })).toThrow(/timeout/)
  })
})

describe('CloudKitProvider.upload', () => {
  it('saves a CloudKit record with backup fields', async () => {
    mockLookupNotFound()
    mockModifyOk()
    mockLookupFound()

    await makeProvider().upload(ENCRYPTED_KEY)

    const modifyCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('records/modify')
    )
    expect(modifyCall).toBeDefined()
    const body = JSON.parse(modifyCall[1]?.body)
    const fields = body.operations[0].record.fields
    expect(fields.encryptionKey).toEqual({ value: ENCRYPTED_KEY })
    expect(fields.cloudEmail).toEqual({ value: '' })
    expect(typeof fields.savedAt?.value).toBe('string')
    expect(fields.savedAt.value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('throws CloudUnavailableError when CloudKit is not reachable', async () => {
    fetchMock.mockRejectOnce(new Error('network unavailable'))

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudUnavailableError,
      /not available/
    )
  })

  it('throws CloudAuthError when CloudKit returns 401', async () => {
    mockJson({ reason: 'unauthorized' }, 401)

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudAuthError,
      /not signed in/
    )
  })

  it('throws CloudStorageError on quota exceeded', async () => {
    mockLookupNotFound()
    fetchMock.mockResponseOnce('insufficient storage quota', { status: 507 })

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudStorageError,
      /quota exceeded/
    )
  })

  it('throws CloudStorageError when record not found after write', async () => {
    mockLookupNotFound()
    mockModifyOk()
    mockLookupNotFound()

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudStorageError,
      /record not found after write/
    )
  })

  it('returns the written payload on success', async () => {
    mockLookupNotFound()
    mockModifyOk()
    mockLookupFound()

    const result = await makeProvider().upload(ENCRYPTED_KEY)
    expect(result.encryptionKey).toBe(ENCRYPTED_KEY)
    expect(result.cloudEmail).toBe('')
  })

  it('includes cloudEmail from config', async () => {
    mockLookupNotFound()
    mockModifyOk()
    mockLookupFound()

    await makeProvider({ cloudEmail: 'user@example.com' }).upload(ENCRYPTED_KEY)

    const modifyCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('records/modify')
    )
    const body = JSON.parse(modifyCall[1]?.body)
    expect(body.operations[0]?.record.fields.cloudEmail?.value).toBe(
      'user@example.com'
    )
  })
})

describe('CloudKitProvider.download', () => {
  it('returns CloudEncryptionKeyFile for an existing backup', async () => {
    mockLookupNotFound()
    mockLookupFound()
    mockLookupFound()

    const result = await makeProvider().download()
    expect(result).toEqual(VALID_PAYLOAD)
  })

  it('returns null when record does not exist', async () => {
    mockLookupNotFound()
    mockLookupNotFound()

    const result = await makeProvider().download()
    expect(result).toBeNull()
  })

  it('retries lookup when it fails initially then succeeds', async () => {
    jest.useFakeTimers()
    mockLookupNotFound()
    mockLookupFound()
    fetchMock
      .mockRejectOnce(new Error('I/O error'))
      .mockResponseOnce(JSON.stringify({ records: [VALID_RECORD] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

    const downloadPromise = makeProvider().download()
    await jest.advanceTimersByTimeAsync(1000)
    const result = await downloadPromise
    expect(result).toEqual(VALID_PAYLOAD)
    jest.useRealTimers()
  })

  it('throws CloudStorageError on invalid record shape', async () => {
    mockLookupNotFound()
    mockLookupFound()
    mockJson({
      records: [{
        recordName: RECORD_NAME,
        fields: { savedAt: { value: VALID_PAYLOAD.savedAt } }
      }]
    })

    await expectError(
      makeProvider().download(),
      CloudStorageError,
      /unexpected shape/
    )
  })

  it('throws CloudAuthError when lookup always fails with auth error', async () => {
    jest.useFakeTimers()
    mockLookupNotFound()
    mockLookupFound()
    fetchMock.mockResponse(JSON.stringify({ reason: 'no account' }), {
      status: 401
    })

    const resultPromise = makeProvider().download().catch((e) => e)
    await jest.runAllTimersAsync()
    const error = await resultPromise
    expect(error).toBeInstanceOf(CloudAuthError)
    expect(error.message).toMatch(/not signed in|Failed to read/)
    jest.useRealTimers()
  })

  it('throws CloudStorageError after all retry attempts are exhausted', async () => {
    jest.useFakeTimers()
    mockLookupNotFound()
    mockLookupFound()
    fetchMock.mockResponse(JSON.stringify({ reason: 'error' }), {
      status: 500
    })

    const resultPromise = makeProvider().download().catch((e) => e)
    await jest.runAllTimersAsync()
    const error = await resultPromise
    expect(error).toBeInstanceOf(CloudStorageError)
    expect(error.message).toMatch(/after \d+ attempts/)
    jest.useRealTimers()
  })

  it('respects custom syncRetryDelayMs from config', async () => {
    jest.useFakeTimers()
    mockLookupNotFound()
    mockLookupFound()
    fetchMock
      .mockRejectOnce(new Error('I/O error'))
      .mockResponseOnce(JSON.stringify({ records: [VALID_RECORD] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

    const provider = makeProvider({ syncRetryDelayMs: 500 })
    const downloadPromise = provider.download()

    await jest.advanceTimersByTimeAsync(499)
    await jest.advanceTimersByTimeAsync(1)

    const result = await downloadPromise
    expect(result).toEqual(VALID_PAYLOAD)
    jest.useRealTimers()
  })

  it('respects custom maxSyncRetries from config', async () => {
    jest.useFakeTimers()
    mockLookupNotFound()
    mockLookupFound()
    fetchMock.mockResponse(JSON.stringify({ reason: 'error' }), {
      status: 500
    })

    const resultPromise = makeProvider({ maxSyncRetries: 3 })
      .download()
      .catch((e) => e)
    await jest.runAllTimersAsync()
    await resultPromise
    const lookupCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('records/lookup')
    )
    // probe + exists + 3 retries = 5
    expect(lookupCalls.length).toBe(5)
    jest.useRealTimers()
  })

  it('throws CloudUnavailableError when CloudKit is unavailable', async () => {
    fetchMock.mockRejectOnce(new Error('network unavailable'))

    await expectError(
      makeProvider().download(),
      CloudUnavailableError,
      /not available/
    )
  })
})

describe('CloudKitProvider.delete', () => {
  it('deletes existing record', async () => {
    mockLookupNotFound()
    mockLookupFound()
    mockModifyOk()

    await makeProvider().delete()

    const deleteCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('records/modify')
    )
    const body = JSON.parse(deleteCall[1]?.body)
    expect(body.operations[0].operationType).toBe('delete')
    expect(body.operations[0].record.recordChangeTag).toBe('abc123change')
  })

  it('throws CloudStorageError when recordChangeTag is missing', async () => {
    mockLookupNotFound()
    mockJson({
      records: [{ ...VALID_RECORD, recordChangeTag: undefined }]
    })

    await expectError(
      makeProvider().delete(),
      CloudStorageError,
      /recordChangeTag/
    )
    const modifyCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('records/modify')
    )
    expect(modifyCalls).toHaveLength(0)
  })

  it('is idempotent when delete returns 404', async () => {
    mockLookupNotFound()
    mockLookupFound()
    fetchMock.mockResponseOnce('', { status: 404 })

    await expect(makeProvider().delete()).resolves.toBeUndefined()
  })

  it('is idempotent when record does not exist', async () => {
    mockLookupNotFound()
    mockLookupNotFound()

    await expect(makeProvider().delete()).resolves.toBeUndefined()
    const modifyCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('records/modify')
    )
    expect(modifyCalls).toHaveLength(0)
  })

  it('throws CloudStorageError when modify returns a failure reason', async () => {
    mockLookupNotFound()
    mockJson({ records: [{ recordName: RECORD_NAME, reason: 'QUOTA_EXCEEDED' }] })

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudStorageError,
      /quota exceeded/
    )

    const modifyCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('records/modify')
    )
    expect(modifyCall).toBeDefined()
    const body = JSON.parse(modifyCall[1]?.body)
    expect(body.operations[0].operationType).toBe('forceUpdate')
  })

  it('throws CloudStorageError if delete fails', async () => {
    mockLookupNotFound()
    mockLookupFound()
    fetchMock.mockResponseOnce('permission denied', { status: 500 })

    await expectError(
      makeProvider().delete(),
      CloudStorageError,
      /Failed to delete/
    )
  })

  it('throws when delete fails at the record level (HTTP 200 with reason)', async () => {
    mockLookupNotFound()
    mockLookupFound()
    mockJson({
      records: [{ recordName: RECORD_NAME, reason: 'SERVER_RECORD_CHANGED' }]
    })

    await expectError(
      makeProvider().delete(),
      CloudUnavailableError,
      /Failed to delete/
    )
  })

  it('treats a RECORD_NOT_FOUND reason on delete as idempotent success', async () => {
    mockLookupNotFound()
    mockLookupFound()
    mockJson({
      records: [{ recordName: RECORD_NAME, reason: 'RECORD_NOT_FOUND' }]
    })

    await expect(makeProvider().delete()).resolves.toBeUndefined()
  })

  it('throws CloudUnavailableError when CloudKit is not available', async () => {
    fetchMock.mockRejectOnce(new Error('network unavailable'))

    await expectError(
      makeProvider().delete(),
      CloudUnavailableError,
      /not available/
    )
  })
})

describe('CloudKitProvider.isAvailable', () => {
  it('returns true when CloudKit lookup succeeds', async () => {
    mockLookupNotFound()
    await expect(makeProvider().isAvailable()).resolves.toBe(true)
  })

  it('returns false when CloudKit lookup fails', async () => {
    fetchMock.mockRejectOnce(new Error('native failure'))
    await expect(makeProvider().isAvailable()).resolves.toBe(false)
  })

  it('returns false when CloudKit returns 401', async () => {
    mockJson({}, 401)
    await expect(makeProvider().isAvailable()).resolves.toBe(false)
  })
})

describe('CloudKitProvider.exists', () => {
  it('returns true when backup record exists', async () => {
    mockLookupNotFound()
    mockLookupFound()

    await expect(makeProvider().exists()).resolves.toBe(true)
  })

  it('returns false when CloudKit is unavailable', async () => {
    fetchMock.mockRejectOnce(new Error('offline'))
    await expect(makeProvider().exists()).resolves.toBe(false)
  })

  it('returns false when record does not exist', async () => {
    mockLookupNotFound()
    mockLookupNotFound()

    await expect(makeProvider().exists()).resolves.toBe(false)
  })

  it('returns false on error', async () => {
    fetchMock.mockRejectOnce(new Error('crash'))
    await expect(makeProvider().exists()).resolves.toBe(false)
  })
})
