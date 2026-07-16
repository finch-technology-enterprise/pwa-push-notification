import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Typography, Alert, CircularProgress, Box } from '@mui/material'
import { AvatarBox } from './AvatarBox'
import { useAccount } from './AccountContext'
import * as AccountApi from '../app/AccountApi'
import { NTFY_GREEN } from './theme'

export function EmailVerify() {
  const navigate = useNavigate()
  const { token } = useAccount()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code || !token) {
      setStatus('error')
      setMessage(!code ? 'Invalid verification link' : 'Please log in first')
      return
    }

    AccountApi.verifyEmail(token, code)
      .then(() => {
        setStatus('success')
        setMessage('Email verified successfully!')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Verification failed')
      })
  }, [searchParams, token])

  return (
    <AvatarBox title="Email verification">
      {status === 'loading' && (
        <Box textAlign="center" py={4}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Verifying your email…
          </Typography>
        </Box>
      )}
      {status === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {status !== 'loading' && (
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/')}
          sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
        >
          Go home
        </Button>
      )}
    </AvatarBox>
  )
}
