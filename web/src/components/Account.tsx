import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tabs,
  Tab,
  Snackbar,
  Link,
  CircularProgress,
} from '@mui/material'
import Delete from '@mui/icons-material/Delete'
import Add from '@mui/icons-material/Add'
import ContentCopy from '@mui/icons-material/ContentCopy'
import { useAccount } from './AccountContext'
import * as AccountApi from '../app/AccountApi'
import type { AccountSubscription, AccountReservation } from '@ntfy-cf/shared'
import { GradientAppBar } from './styles'
import { NTFY_GREEN } from './theme'
import { enableReservations } from '../app/config'

export function Account() {
  const navigate = useNavigate()
  const { account, token, logout } = useAccount()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [accountData, setAccountData] = useState<import('@ntfy-cf/shared').Account | null>(null)
  const [snackbar, setSnackbar] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [tokenString, setTokenString] = useState('')

  useEffect(() => {
    if (token) {
      AccountApi.getAccount(token)
        .then(setAccountData)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const handleCreateToken = useCallback(async () => {
    if (!token) return
    try {
      const result = await AccountApi.createToken(token, newTokenLabel || undefined)
      setTokenString(result.token)
      setShowToken(false)
      setNewTokenLabel('')
      setSnackbar('Token created')
      const updated = await AccountApi.getAccount(token)
      setAccountData(updated)
    } catch (err) {
      setSnackbar('Failed to create token')
    }
  }, [token, newTokenLabel])

  const handleDeleteToken = useCallback(
    async (tokenId: string) => {
      if (!token) return
      try {
        await AccountApi.deleteToken(token, tokenId)
        setSnackbar('Token deleted')
        const updated = await AccountApi.getAccount(token)
        setAccountData(updated)
      } catch {
        setSnackbar('Failed to delete token')
      }
    },
    [token],
  )

  const handleAddEmail = useCallback(async () => {
    if (!token || !newEmail) return
    try {
      await AccountApi.addEmail(token, newEmail)
      setNewEmail('')
      setSnackbar('Email added. Check your inbox for verification.')
      const updated = await AccountApi.getAccount(token)
      setAccountData(updated)
    } catch {
      setSnackbar('Failed to add email')
    }
  }, [token, newEmail])

  const handleDeleteEmail = useCallback(
    async (email: string) => {
      if (!token) return
      try {
        await AccountApi.deleteEmail(token, email)
        setSnackbar('Email deleted')
        const updated = await AccountApi.getAccount(token)
        setAccountData(updated)
      } catch {
        setSnackbar('Failed to delete email')
      }
    },
    [token],
  )

  const handleDeleteAccount = useCallback(async () => {
    if (!token) return
    try {
      await AccountApi.deleteAccount(token)
      logout()
      navigate('/')
    } catch {
      setSnackbar('Failed to delete account')
    }
  }, [token, logout, navigate])

  if (!token || !account) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Please log in to view your account</Typography>
        <Button onClick={() => navigate('/login')} sx={{ mt: 2, color: NTFY_GREEN }}>
          Log in
        </Button>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GradientAppBar>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, fontSize: 16 }}>
          Account
        </Typography>
        <Button color="inherit" onClick={() => navigate('/')}>
          Back
        </Button>
      </GradientAppBar>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Profile" />
          <Tab label="Tokens" />
          {enableReservations && <Tab label="Reservations" />}
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
        {tab === 0 && accountData && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Profile
                </Typography>
                <Typography variant="body2">
                  <strong>Username:</strong> {accountData.user}
                </Typography>
                <Typography variant="body2">
                  <strong>Role:</strong> {accountData.role}
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {new Date(accountData.created * 1000).toLocaleDateString()}
                </Typography>
                {accountData.tier && (
                  <Typography variant="body2">
                    <strong>Plan:</strong> {accountData.tier.name}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Emails
                </Typography>
                {accountData.emails && accountData.emails.length > 0 ? (
                  <List dense>
                    {accountData.emails.map((e) => (
                      <ListItem key={e}>
                        <ListItemText primary={e} />
                        <ListItemSecondaryAction>
                          <IconButton size="small" onClick={() => handleDeleteEmail(e)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No emails added
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={handleAddEmail}
                    sx={{ borderColor: NTFY_GREEN, color: NTFY_GREEN }}
                  >
                    Add
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Subscriptions
                </Typography>
                {accountData.subscriptions && accountData.subscriptions.length > 0 ? (
                  <List dense>
                    {accountData.subscriptions.map((s) => (
                      <ListItem key={s.topic}>
                        <ListItemText primary={s.topic} secondary={s.base_url || 'Default server'} />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No subscriptions synced
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Button
              variant="outlined"
              color="error"
              onClick={() => setShowDelete(true)}
              sx={{ mt: 2 }}
            >
              Delete Account
            </Button>
          </Box>
        )}

        {tab === 1 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>
                  Access Tokens
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setShowToken(true)}
                  sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
                >
                  New Token
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Tokens can be used to authenticate API requests
              </Typography>
            </CardContent>
          </Card>
        )}

        {tab === 2 && accountData?.reservations && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Topic Reservations
              </Typography>
              {accountData.reservations.length > 0 ? (
                <List dense>
                  {accountData.reservations.map((r) => (
                    <ListItem key={r.id}>
                      <ListItemText primary={r.topic} secondary={r.permission} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No reservations
                </Typography>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      <Dialog open={showToken} onClose={() => setShowToken(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Token</DialogTitle>
        <DialogContent>
          {tokenString ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Token created successfully. Copy it now - you won't see it again.
              </Alert>
              <TextField
                fullWidth
                value={tokenString}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton onClick={() => { navigator.clipboard.writeText(tokenString); setSnackbar('Copied!') }}>
                      <ContentCopy />
                    </IconButton>
                  ),
                }}
              />
            </Box>
          ) : (
            <TextField
              label="Label (optional)"
              value={newTokenLabel}
              onChange={(e) => setNewTokenLabel(e.target.value)}
              fullWidth
              autoFocus
              size="small"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowToken(false); setTokenString('') }}>
            {tokenString ? 'Close' : 'Cancel'}
          </Button>
          {!tokenString && (
            <Button onClick={handleCreateToken} sx={{ color: NTFY_GREEN }}>
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={showDelete} onClose={() => setShowDelete(false)}>
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <Typography>Are you sure? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteAccount}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        message={snackbar}
      />
    </Box>
  )
}
