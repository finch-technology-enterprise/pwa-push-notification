import { useState, useCallback } from 'react'
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import {
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  InputAdornment,
  IconButton,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { AvatarBox } from './AvatarBox'
import * as AccountApi from '../app/AccountApi'
import { NTFY_GREEN } from './theme'

export function PasswordReset() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!token) {
      setError('Invalid reset token')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setLoading(true)
    try {
      await AccountApi.resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
    setLoading(false)
  }, [token, password, confirmPassword])

  if (success) {
    return (
      <AvatarBox title="Password reset">
        <Alert severity="success" sx={{ mb: 2 }}>
          Your password has been reset successfully.
        </Alert>
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/login')}
          sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
        >
          Log in
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
        label="New password"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        size="small"
        autoFocus
        sx={{ mb: 2 }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <TextField
        label="Confirm password"
        type={showPassword ? 'text' : 'password'}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 3 }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <Button
        variant="contained"
        fullWidth
        onClick={handleSubmit}
        disabled={loading || !password || !confirmPassword}
        sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' }, mb: 2 }}
      >
        {loading ? 'Resetting…' : 'Reset password'}
      </Button>
      <Typography variant="body2" textAlign="center">
        <Link component={RouterLink} to="/login" sx={{ color: NTFY_GREEN, cursor: 'pointer' }}>
          Back to login
        </Link>
      </Typography>
    </AvatarBox>
  )
}
