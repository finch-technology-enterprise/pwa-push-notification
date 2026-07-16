import { useState, useCallback } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { TextField, Button, Typography, Alert, Link } from '@mui/material'
import { AvatarBox } from './AvatarBox'
import * as AccountApi from '../app/AccountApi'
import { NTFY_GREEN } from './theme'

export function PasswordResetRequest() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await AccountApi.requestPasswordReset(email)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request reset')
    }
    setLoading(false)
  }, [email])

  if (success) {
    return (
      <AvatarBox title="Check your email">
        <Alert severity="success" sx={{ mb: 2 }}>
          If an account with that email exists, a password reset link has been sent.
        </Alert>
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/login')}
          sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
        >
          Back to login
        </Button>
      </AvatarBox>
    )
  }

  return (
    <AvatarBox title="Reset password">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        size="small"
        autoFocus
        type="email"
        sx={{ mb: 3 }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <Button
        variant="contained"
        fullWidth
        onClick={handleSubmit}
        disabled={loading || !email}
        sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' }, mb: 2 }}
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>
      <Typography variant="body2" textAlign="center">
        <Link component={RouterLink} to="/login" sx={{ color: NTFY_GREEN, cursor: 'pointer' }}>
          Back to login
        </Link>
      </Typography>
    </AvatarBox>
  )
}
