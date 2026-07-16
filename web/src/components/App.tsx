import { useMemo, useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { lightTheme, darkTheme } from './theme'
import { AccountContext } from './AccountContext'
import { ErrorBoundary } from './ErrorBoundary'
import { Navigation } from './Navigation'
import { ActionBar } from './ActionBar'
import { Notifications } from './Notifications'
import { Messaging } from './Messaging'
import { Login } from './Login'
import { Signup } from './Signup'
import { Account } from './Account'
import { Preferences } from './Preferences'
import { PasswordResetRequest } from './PasswordResetRequest'
import { PasswordReset } from './PasswordReset'
import { EmailVerify } from './EmailVerify'
import sessionManager from '../app/Session'
import prefsManager from '../app/Prefs'
import pruner from '../app/Pruner'
import userManager from '../app/UserManager'
import '../app/i18n'

export function App() {
  const [account, setAccountState] = useState(sessionManager.getAccount())
  const [token, setToken] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    sessionManager.loadFromStorage()
    pruner.start()

    prefsManager.get('theme').then((t) => {
      const mode = t === 'dark' ? 'dark' : t === 'light' ? 'light' : 'light'
      setThemeMode(mode)
    })

    return () => {
      pruner.stop()
    }
  }, [])

  const setAccount = useCallback(
    (acc: typeof account, tok?: string | null) => {
      setAccountState(acc)
      if (tok !== undefined) setToken(tok)
      sessionManager.setAccount(acc)
      if (tok) {
        userManager.saveUser({ baseUrl: '', token: tok, username: acc?.user || '' })
      }
    },
    [],
  )

  const logout = useCallback(() => {
    setAccountState(null)
    setToken(null)
    sessionManager.logout()
  }, [])

  const theme = useMemo(
    () => (themeMode === 'dark' ? darkTheme : lightTheme),
    [themeMode],
  )

  const ctx = useMemo(
    () => ({ account, token, setAccount, logout }),
    [account, token, setAccount, logout],
  )

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AccountContext.Provider value={ctx}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Preferences />} />
              <Route path="/reset-password" element={<PasswordResetRequest />} />
              <Route path="/reset-password/:token" element={<PasswordReset />} />
              <Route path="/email-verify" element={<EmailVerify />} />
              <Route path="/" element={<AppLayout />} />
              <Route path="/:topic" element={<AppLayout />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AccountContext.Provider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

function AppLayout() {
  const { topic } = useParams<{ topic?: string }>()
  const [drawerOpen, setDrawerOpen] = useState(true)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Navigation open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ActionBar
          topic={topic}
          onMenuToggle={() => setDrawerOpen(!drawerOpen)}
        />
        <Notifications topic={topic} />
        {topic && <Messaging topic={topic} />}
      </main>
    </div>
  )
}
