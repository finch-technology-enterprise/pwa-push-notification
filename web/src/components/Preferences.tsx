import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Snackbar,
  Divider,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material'
import { GradientAppBar } from './styles'
import prefsManager from '../app/Prefs'
import { NTFY_GREEN } from './theme'

export function Preferences() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState('')
  const [prefs, setPrefs] = useState({
    theme: 'system' as string,
    sound: 'default' as string,
    soundEnabled: true,
    vibrationEnabled: true,
    desktopNotifications: true,
    webPushEnabled: false,
    dateFormat: 'relative' as string,
    defaultPriority: 3,
    defaultDeleteAfter: 0,
    showRead: true,
    pageSize: 50,
  })

  useEffect(() => {
    prefsManager.getAll().then((all) => {
      setPrefs((prev) => ({
        ...prev,
        theme: (all.theme as string) || 'system',
        sound: (all.sound as string) || 'default',
        soundEnabled: (all.soundEnabled as boolean) ?? true,
        vibrationEnabled: (all.vibrationEnabled as boolean) ?? true,
        desktopNotifications: (all.desktopNotifications as boolean) ?? true,
        webPushEnabled: (all.webPushEnabled as boolean) ?? false,
        dateFormat: (all.dateFormat as string) || 'relative',
        defaultPriority: (all.defaultPriority as number) || 3,
        defaultDeleteAfter: (all.defaultDeleteAfter as number) || 0,
        showRead: (all.showRead as boolean) ?? true,
        pageSize: (all.pageSize as number) || 50,
      }))
      setLoading(false)
    })
  }, [])

  const updatePref = useCallback(
    <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
      setPrefs((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(prefs)) {
        await prefsManager.set(key, value as string | number | boolean)
      }
      setSnackbar('Settings saved')
    } catch {
      setSnackbar('Failed to save settings')
    }
    setSaving(false)
  }, [prefs])

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
          Settings
        </Typography>
        <Button color="inherit" onClick={() => navigate('/')}>
          Back
        </Button>
      </GradientAppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Appearance
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Theme</InputLabel>
              <Select
                value={prefs.theme}
                label="Theme"
                onChange={(e) => updatePref('theme', e.target.value)}
              >
                <MenuItem value="system">System</MenuItem>
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notifications
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.soundEnabled}
                  onChange={(e) => updatePref('soundEnabled', e.target.checked)}
                />
              }
              label="Sound"
            />
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Notification sound</InputLabel>
              <Select
                value={prefs.sound}
                label="Notification sound"
                onChange={(e) => updatePref('sound', e.target.value)}
              >
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.vibrationEnabled}
                  onChange={(e) => updatePref('vibrationEnabled', e.target.checked)}
                />
              }
              label="Vibration"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.desktopNotifications}
                  onChange={(e) => updatePref('desktopNotifications', e.target.checked)}
                />
              }
              label="Desktop notifications"
            />
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Display
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Date format</InputLabel>
              <Select
                value={prefs.dateFormat}
                label="Date format"
                onChange={(e) => updatePref('dateFormat', e.target.value)}
              >
                <MenuItem value="relative">Relative (2m ago)</MenuItem>
                <MenuItem value="absolute">Absolute (Jan 1, 2:30 PM)</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.showRead}
                  onChange={(e) => updatePref('showRead', e.target.checked)}
                />
              }
              label="Show read notifications"
            />
            <TextField
              label="Page size"
              type="number"
              value={prefs.pageSize}
              onChange={(e) => updatePref('pageSize', parseInt(e.target.value) || 50)}
              size="small"
              fullWidth
              sx={{ mt: 2 }}
            />
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
          <Button onClick={() => navigate('/')}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        message={snackbar}
      />
    </Box>
  )
}
