import { jest } from '@jest/globals'
import { GoogleDriveProvider } from '../src/providers/googleDriveProvider.js'
import {
  CloudAuthError,
  CloudStorageError,
  CloudUnavailableError,
  CloudValidationError
} from '../src/errors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCESS_TOKEN = 'test_access_token'
const ENCRYPTED_KEY = 'encrypted_master_key_hex'
const DEFAULT_PATH = 'wallet_backup_key.json'
const FILE_ID = 'drive_file_id_123'

const VALID_PAYLOAD = {
  encryptionKey: ENCRYPTED_KEY,
  savedAt: '2026-02-25T00:00:00.000Z',
  cloudEmail: ''
}

function makeProvider (config) {
  return new GoogleDriveProvider({
    accessToken: config?.accessToken ?? (config?.getAccessToken ? undefined : ACCESS_TOKEN),
    ...config
  })
}

async function expectError (promise, ErrorClass, message) {
  const err = await promise.catch((e) => e)
  expect(err).toBeInstanceOf(ErrorClass)
  expect(err.message).toMatch(message)
}

function mockListFiles (files = []) {
  fetchMock.mockResponseOnce(
    JSON.stringify({ files }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function mockOk (body = '{}') {
  fetchMock.mockResponseOnce(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function mockText (body, status = 200) {
  fetchMock.mockResponseOnce(body, { status })
}

function mockError (status, body = 'error') {
  fetchMock.mockResponseOnce(body, { status })
}

beforeEach(() => {
  fetchMock.resetMocks()
})

describe('GoogleDriveProvider constructor', () => {
  it('throws when neither accessToken nor getAccessToken is provided', () => {
    expect(() => new GoogleDriveProvider({})).toThrow(
      /accessToken or getAccessToken/
    )
  })

  it('throws when timeout is invalid', () => {
    expect(() => makeProvider({ timeout: 0 })).toThrow(/timeout/)
    expect(() => makeProvider({ timeout: -1 })).toThrow(CloudValidationError)
  })
})

describe('GoogleDriveProvider.upload', () => {
  it('creates a new file in appDataFolder when none exists', async () => {
    mockListFiles()
    mockOk()
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])

    await makeProvider().upload(ENCRYPTED_KEY)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const createCall = fetchMock.mock.calls[1]
    expect(createCall[0]).toContain('upload/drive/v3/files?uploadType=multipart')
    expect(createCall[1]?.method).toBe('POST')
    const authHeader = createCall[1]?.headers?.Authorization ??
      new Headers(createCall[1]?.headers).get('Authorization')
    expect(authHeader).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('uses getAccessToken when provided', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('fresh_token')
    mockListFiles()
    mockOk()
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])

    await makeProvider({ getAccessToken }).upload(ENCRYPTED_KEY)

    expect(getAccessToken).toHaveBeenCalled()
    const createCall = fetchMock.mock.calls[1]
    const authHeader = new Headers(createCall[1]?.headers).get('Authorization')
    expect(authHeader).toBe('Bearer fresh_token')
  })

  it('writes CloudEncryptionKeyFile JSON content', async () => {
    mockListFiles()
    mockOk()
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])

    await makeProvider().upload(ENCRYPTED_KEY)

    const createBody = fetchMock.mock.calls[1][1]?.body
    expect(createBody).toContain('"encryptionKey"')
    expect(createBody).toContain(ENCRYPTED_KEY)
    expect(createBody).toContain('"cloudEmail"')
    expect(createBody).toContain('"savedAt"')
  })

  it('updates existing file when one is found', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockOk()
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])

    await makeProvider().upload(ENCRYPTED_KEY)

    const updateCall = fetchMock.mock.calls[1]
    expect(updateCall[0]).toContain(`/files/${FILE_ID}?uploadType=media`)
    expect(updateCall[1]?.method).toBe('PATCH')
  })

  it('throws CloudStorageError when file not found after write', async () => {
    mockListFiles()
    mockOk()
    mockListFiles()

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudStorageError,
      /file not found after write/
    )
  })

  it('throws CloudAuthError on auth failure during write', async () => {
    mockListFiles()
    mockError(401, 'unauthorized')

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudAuthError,
      /authentication failed/
    )
  })

  it('throws CloudUnavailableError on network failure', async () => {
    fetchMock.mockRejectOnce(new Error('network unavailable'))

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudUnavailableError,
      /unavailable/
    )
  })

  it('returns the written payload on success', async () => {
    mockListFiles()
    mockOk()
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])

    const result = await makeProvider().upload(ENCRYPTED_KEY)
    expect(result.encryptionKey).toBe(ENCRYPTED_KEY)
    expect(typeof result.savedAt).toBe('string')
    expect(result.cloudEmail).toBe('')
  })

  it('uses custom file path basename in Drive query', async () => {
    mockListFiles()
    mockOk()
    mockListFiles([{ id: FILE_ID, name: 'backup.json' }])

    await makeProvider({ filePath: 'custom/backup.json' }).upload(ENCRYPTED_KEY)

    const listUrl = String(fetchMock.mock.calls[0][0])
    expect(listUrl).toContain(encodeURIComponent("name='backup.json'"))
  })

  it('includes cloudEmail from config', async () => {
    mockListFiles()
    mockOk()
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])

    await makeProvider({ cloudEmail: 'user@example.com' }).upload(ENCRYPTED_KEY)

    const createBody = fetchMock.mock.calls[1][1]?.body
    expect(createBody).toContain('user@example.com')
  })
})

describe('GoogleDriveProvider.download', () => {
  it('returns CloudEncryptionKeyFile when file exists', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockText(JSON.stringify(VALID_PAYLOAD))

    const result = await makeProvider().download()
    expect(result).toEqual(VALID_PAYLOAD)
  })

  it('throws when file list fails with server error', async () => {
    mockError(500, 'server error')

    await expectError(
      makeProvider().download(),
      CloudStorageError,
      /Failed to check Google Drive file existence/
    )
  })

  it('returns null when no file exists', async () => {
    mockListFiles()

    const result = await makeProvider().download()
    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null on 404 during download', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockError(404, 'not found')

    const result = await makeProvider().download()
    expect(result).toBeNull()
  })

  it('throws CloudStorageError when downloaded payload has wrong shape', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockText(JSON.stringify({ bad: 'data' }))

    await expectError(
      makeProvider().download(),
      CloudStorageError,
      /unexpected shape/
    )
  })

  it('throws when payload is missing savedAt or cloudEmail', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockText(JSON.stringify({ encryptionKey: 'x' }))

    await expectError(
      makeProvider().download(),
      CloudStorageError,
      /unexpected shape/
    )
  })

  it('throws CloudAuthError on auth failure during read', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockError(401, 'unauthorized')

    await expectError(
      makeProvider().download(),
      CloudAuthError,
      /authentication failed/
    )
  })

  it('throws CloudStorageError on invalid JSON', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockText('not json {{')

    await expectError(
      makeProvider().download(),
      CloudStorageError,
      /invalid JSON/
    )
  })

  it('throws CloudStorageError on 400 bad request during list', async () => {
    mockError(400, 'malformed query')

    await expectError(
      makeProvider().upload(ENCRYPTED_KEY),
      CloudStorageError,
      /400 Bad Request/
    )
  })
})

describe('GoogleDriveProvider.delete', () => {
  it('deletes existing file', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockOk()

    await makeProvider().delete()

    const deleteCall = fetchMock.mock.calls[1]
    expect(deleteCall[0]).toContain(`/files/${FILE_ID}`)
    expect(deleteCall[1]?.method).toBe('DELETE')
  })

  it('throws when existence check fails during delete', async () => {
    mockError(500, 'server error')

    await expectError(
      makeProvider().delete(),
      CloudStorageError,
      /Failed to check Google Drive file existence/
    )
  })

  it('is idempotent when no file exists', async () => {
    mockListFiles()

    await expect(makeProvider().delete()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws CloudAuthError on auth failure during delete', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    mockError(403, 'forbidden')

    await expectError(
      makeProvider().delete(),
      CloudAuthError,
      /authentication failed/
    )
  })
})

describe('GoogleDriveProvider.isAvailable', () => {
  it('returns true when Drive about endpoint succeeds', async () => {
    mockOk(JSON.stringify({ user: { displayName: 'Test' } }))
    await expect(makeProvider().isAvailable()).resolves.toBe(true)
  })

  it('returns false on error', async () => {
    fetchMock.mockRejectOnce(new Error('offline'))
    await expect(makeProvider().isAvailable()).resolves.toBe(false)
  })

  it('returns false when about returns non-ok', async () => {
    mockError(503, 'unavailable')
    await expect(makeProvider().isAvailable()).resolves.toBe(false)
  })
})

describe('GoogleDriveProvider.exists', () => {
  it('returns true when file exists', async () => {
    mockListFiles([{ id: FILE_ID, name: DEFAULT_PATH }])
    await expect(makeProvider().exists()).resolves.toBe(true)
  })

  it('returns false when file does not exist', async () => {
    mockListFiles()
    await expect(makeProvider().exists()).resolves.toBe(false)
  })

  it('returns false on any error', async () => {
    fetchMock.mockRejectOnce(new Error('unknown'))
    await expect(makeProvider().exists()).resolves.toBe(false)
  })
})
