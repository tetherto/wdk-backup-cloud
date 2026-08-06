/**
 * Test setup — configure jest-fetch-mock so `fetch` is available globally.
 * Note: only `enableMocks()` here — beforeEach resets are in individual test files.
 */
import fetchMock from 'jest-fetch-mock'

fetchMock.enableMocks()
