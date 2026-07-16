import { useState, useCallback } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link,
  InputAdornment,
  IconButton,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { AvatarBox } from './AvatarBox'
import { useAccount } from './AccountContext'
import * as AccountApi from '../app/AccountApi'
import { NTFY_GREEN } from './theme'
import { enableLogin } from '../app/config'

export function Signup() {
  const navigate = useNavigate()
  const { setAccount } = useAccount()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = useCallback(async () => {
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const account = await AccountApi.signup(user, password)
      setAccount(account)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    }
    setLoading(false)
  }, [user, password, confirmPassword, setAccount, navigate])

  return (
    <AvatarBox title="Sign up" subtitle="Create a new account">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Username"
        value={user}
        onChange={(e) => setUser(e.target.value)}
        fullWidth
        size="small"
        autoFocus
        sx={{ mb: 2 }}
      />
      <TextField
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        size="small"
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
        onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={handleSignup}
        disabled={loading || !user || !password || !confirmPassword}
        sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' }, mb: 2 }}
      >
        {loading ? 'Signing up…' : 'Sign up'}
      </Button>

      {enableLogin && (
        <Typography variant="body2" textAlign="center" color="text.secondary">
          Already have an account?{' '}
          <Link component={RouterLink} to="/login" sx={{ color: NTFY_GREEN, cursor: 'pointer' }}>
            Log in
          </Link>
        </Typography>
      )}
    </AvatarBox>
  )
}
