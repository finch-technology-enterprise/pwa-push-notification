import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { App } from '../components/App'

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('ntfy')).toBeTruthy()
    }, { timeout: 5000 })
  })
})
