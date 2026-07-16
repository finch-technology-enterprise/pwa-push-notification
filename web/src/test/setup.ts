import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

process.on('unhandledRejection', () => {
  // Suppress async React state updates after test teardown
})
