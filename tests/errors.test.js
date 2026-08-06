import {
  CloudAuthError,
  CloudStorageError,
  CloudUnavailableError,
  CloudValidationError
} from '../src/errors.js'

describe('Error classes', () => {
  // -------------------------------------------------------------------------
  // CloudUnavailableError
  // -------------------------------------------------------------------------

  describe('CloudUnavailableError', () => {
    it('has correct name', () => {
      const err = new CloudUnavailableError()
      expect(err.name).toBe('CloudUnavailableError')
    })

    it('has correct code', () => {
      const err = new CloudUnavailableError()
      expect(err.code).toBe('CLOUD_UNAVAILABLE')
    })

    it('uses default message when none supplied', () => {
      const err = new CloudUnavailableError()
      expect(err.message).toBe('Cloud storage is unavailable')
    })

    it('uses custom message', () => {
      const err = new CloudUnavailableError('CloudKit off')
      expect(err.message).toBe('CloudKit off')
    })

    it('stores cause', () => {
      const cause = new Error('net error')
      const err = new CloudUnavailableError('oops', cause)
      expect(err.cause).toBe(cause)
    })

    it('is instanceof Error', () => {
      expect(new CloudUnavailableError()).toBeInstanceOf(Error)
    })

    it('is instanceof CloudUnavailableError', () => {
      expect(new CloudUnavailableError()).toBeInstanceOf(CloudUnavailableError)
    })
  })

  // -------------------------------------------------------------------------
  // CloudAuthError
  // -------------------------------------------------------------------------

  describe('CloudAuthError', () => {
    it('has correct name', () => {
      expect(new CloudAuthError().name).toBe('CloudAuthError')
    })

    it('has correct code', () => {
      expect(new CloudAuthError().code).toBe('CLOUD_AUTH_ERROR')
    })

    it('uses default message', () => {
      expect(new CloudAuthError().message).toBe('Cloud authentication failed')
    })

    it('accepts custom message and cause', () => {
      const c = new Error('401')
      const err = new CloudAuthError('token expired', c)
      expect(err.message).toBe('token expired')
      expect(err.cause).toBe(c)
    })

    it('is instanceof Error', () => {
      expect(new CloudAuthError()).toBeInstanceOf(Error)
    })
  })

  // -------------------------------------------------------------------------
  // CloudStorageError
  // -------------------------------------------------------------------------

  describe('CloudStorageError', () => {
    it('has correct name', () => {
      expect(new CloudStorageError().name).toBe('CloudStorageError')
    })

    it('has correct code', () => {
      expect(new CloudStorageError().code).toBe('CLOUD_STORAGE_ERROR')
    })

    it('uses default message', () => {
      expect(new CloudStorageError().message).toBe(
        'Cloud storage operation failed'
      )
    })

    it('stores cause', () => {
      const c = new Error('quota')
      expect(new CloudStorageError('q', c).cause).toBe(c)
    })

    it('is instanceof Error', () => {
      expect(new CloudStorageError()).toBeInstanceOf(Error)
    })
  })

  // -------------------------------------------------------------------------
  // CloudValidationError
  // -------------------------------------------------------------------------

  describe('CloudValidationError', () => {
    it('has correct name', () => {
      expect(new CloudValidationError().name).toBe('CloudValidationError')
    })

    it('has correct code', () => {
      expect(new CloudValidationError().code).toBe('CLOUD_VALIDATION_ERROR')
    })

    it('uses default message', () => {
      expect(new CloudValidationError().message).toBe(
        'Cloud backup validation failed'
      )
    })

    it('is instanceof Error', () => {
      expect(new CloudValidationError()).toBeInstanceOf(Error)
    })
  })

  // -------------------------------------------------------------------------
  // Cross-class isolation (instanceof must not bleed)
  // -------------------------------------------------------------------------

  describe('Cross-class isolation', () => {
    it('CloudUnavailableError is NOT instanceof CloudAuthError', () => {
      expect(new CloudUnavailableError()).not.toBeInstanceOf(CloudAuthError)
    })

    it('CloudAuthError is NOT instanceof CloudUnavailableError', () => {
      expect(new CloudAuthError()).not.toBeInstanceOf(CloudUnavailableError)
    })

    it('CloudStorageError is NOT instanceof CloudValidationError', () => {
      expect(new CloudStorageError()).not.toBeInstanceOf(CloudValidationError)
    })

    it('each error code is unique', () => {
      const codes = new Set([
        new CloudUnavailableError().code,
        new CloudAuthError().code,
        new CloudStorageError().code,
        new CloudValidationError().code
      ])
      expect(codes.size).toBe(4)
    })
  })
})
