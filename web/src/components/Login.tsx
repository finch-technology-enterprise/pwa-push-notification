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
import { AuthError } from '../app/errors'
import { NTFY_GREEN } from './theme'
import { enableSignup } from '../app/config'

export function Login() {
  const navigate = useNavigate()
  const { setAccount } = useAccount()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [useToken, setUseToken] = useState(false)

  const handleLogin = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      if (useToken) {
        setAccount({ id: '', user: '', role: 'user', prefs: {}, sync_topic: '', created: 0 }, token)
        navigate('/')
      } else {
        const account = await AccountApi.login(user, password)
        setAccount(account)
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Login failed')
    }
    setLoading(false)
  }, [user, password, token, useToken, setAccount, navigate])

  return (
    <AvatarBox title="Log in" subtitle="Welcome back">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        size="small"
        onClick={() => setUseToken(!useToken)}
        sx={{ mb: 2, textTransform: 'none', color: NTFY_GREEN }}
      >
        {useToken ? 'Use password instead' : 'Use access token instead'}
      </Button>

      {useToken ? (
        <TextField
          label="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          fullWidth
          size="small"
          autoFocus
          sx={{ mb: 2 }}
        />
      ) : (
        <>
          <TextField
            label="Username / Email"
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
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
          <Box textAlign="right" sx={{ mb: 2 }}>
            <Link
              component={RouterLink}
              to="/reset-password"
              variant="caption"
              sx={{ color: NTFY_GREEN, cursor: 'pointer' }}
            >
              Forgot password?
            </Link>
          </Box>
        </>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={handleLogin}
        disabled={loading || (useToken ? !token : !user || !password)}
        sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' }, mb: 2 }}
      >
        {loading ? 'Logging in…' : 'Log in'}
      </Button>

      {enableSignup && !useToken && (
        <Typography variant="body2" textAlign="center" color="text.secondary">
          Don't have an account?{' '}
          <Link component={RouterLink} to="/signup" sx={{ color: NTFY_GREEN, cursor: 'pointer' }}>
            Sign up
          </Link>
        </Typography>
      )}
    </AvatarBox>
  )
}
