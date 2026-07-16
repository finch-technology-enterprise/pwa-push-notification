import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Badge,
  Button,
  Tooltip,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material'
import Add from '@mui/icons-material/Add'
import Send from '@mui/icons-material/Send'
import Settings from '@mui/icons-material/Settings'
import Person from '@mui/icons-material/Person'
import Logout from '@mui/icons-material/Logout'
import LoginIcon from '@mui/icons-material/Login'
import NotificationsIcon from '@mui/icons-material/Notifications'
import Inbox from '@mui/icons-material/Inbox'
import Circle from '@mui/icons-material/Circle'
import { SidebarDrawer, SidebarHeader, ConnectionStatusDot } from './styles'
import { SubscribeDialog } from './SubscribeDialog'
import { PublishDialog } from './PublishDialog'
import { useAccount } from './AccountContext'
import connectionManager from '../app/ConnectionManager'
import subscriptionManager from '../app/SubscriptionManager'
import type { StoredSubscription } from '../app/db'
import { NTFY_GREEN } from './theme'

interface NavigationProps {
  open: boolean
  onToggle: () => void
}

export function Navigation({ open, onToggle }: NavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { account, logout } = useAccount()

  const [subscriptions, setSubscriptions] = useState<StoredSubscription[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({})
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [notificationAlert, setNotificationAlert] = useState(false)

  const currentTopic = location.pathname.slice(1) || undefined

  const loadData = useCallback(async () => {
    const subs = await subscriptionManager.getSubscriptions()
    setSubscriptions(subs)

    const counts: Record<string, number> = {}
    for (const sub of subs) {
      counts[sub.topic] = await subscriptionManager.getUnreadCount(sub.topic)
    }
    setUnreadCounts(counts)
  }, [])

  useEffect(() => {
    loadData()

    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    for (const sub of subscriptions) {
      if (!connectionManager.isConnected(sub.topic)) {
        connectionManager.subscribe(sub.topic)
      }
    }
  }, [subscriptions])

  useEffect(() => {
    const unsub = connectionManager.onStatus((topic, status) => {
      setConnectionStatuses((prev) => ({ ...prev, [topic]: status }))
    })
    return unsub
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setNotificationAlert(true)
    }
  }, [])

  const handleSubscribe = (topic: string) => {
    subscriptionManager.addSubscription({ topic, baseUrl: '' })
    connectionManager.subscribe(topic)
    navigate(`/${topic}`)
    loadData()
  }

  const handleRemove = async (topic: string) => {
    await subscriptionManager.removeSubscription(topic)
    connectionManager.unsubscribe(topic)
    if (currentTopic === topic) {
      navigate('/')
    }
    loadData()
  }

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  return (
    <>
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: open ? 320 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            position: 'relative',
          },
        }}
      >
        <SidebarDrawer>
          <SidebarHeader>
            <Box
              component="span"
              sx={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <NotificationsIcon />
              ntfy
            </Box>
          </SidebarHeader>

          <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              fullWidth
              startIcon={<Add />}
              onClick={() => setSubscribeOpen(true)}
              sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
            >
              Subscribe
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<Send />}
              onClick={() => setPublishOpen(true)}
              sx={{ borderColor: NTFY_GREEN, color: NTFY_GREEN }}
            >
              Publish
            </Button>
          </Box>

          {notificationAlert && (
            <Box sx={{ px: 1.5, pb: 1 }}>
              <Alert
                severity="info"
                onClose={() => setNotificationAlert(false)}
                sx={{ fontSize: 12, py: 0, px: 1 }}
              >
                Enable desktop notifications
              </Alert>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontWeight: 600 }}>
              TOPICS
            </Typography>
          </Box>

          <List dense sx={{ flex: 1, overflow: 'auto' }}>
            <ListItem disablePadding>
              <ListItemButton
                selected={!currentTopic}
                onClick={() => navigate('/')}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Inbox fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="All notifications"
                  primaryTypographyProps={{ variant: 'body2', fontWeight: currentTopic ? 400 : 700 }}
                />
                {totalUnread > 0 && (
                  <Badge badgeContent={totalUnread} color="primary" max={999} />
                )}
              </ListItemButton>
            </ListItem>

            <Divider sx={{ my: 0.5 }} />

            {subscriptions.map((sub) => {
              const unread = unreadCounts[sub.topic] || 0
              const status = connectionStatuses[sub.topic] || 'disconnected'
              const isSelected = currentTopic === sub.topic

              return (
                <ListItem key={sub.topic} disablePadding secondaryAction={
                  unread > 0 ? (
                    <Badge badgeContent={unread} color="primary" max={999} />
                  ) : null
                }>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => navigate(`/${sub.topic}`)}
                    sx={{ pr: unread > 0 ? 8 : 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <ConnectionStatusDot status={status} />
                    </ListItemIcon>
                    <ListItemText
                      primary={sub.displayName || sub.topic}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: isSelected ? 700 : 400,
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )
            })}

            {subscriptions.length === 0 && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No subscriptions yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Subscribe to a topic to get started
                </Typography>
              </Box>
            )}
          </List>

          <Divider />

          <List dense>
            {account ? (
              <>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate('/account')}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Person fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={account.user || 'Account'}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate('/settings')}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Settings fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Settings"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={logout}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Logout fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Log out"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
              </>
            ) : (
              <>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate('/login')}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <LoginIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Log in"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate('/signup')}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Person fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sign up"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate('/settings')}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Settings fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Settings"
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
              </>
            )}
          </List>
        </SidebarDrawer>
      </Drawer>

      <SubscribeDialog
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        onSubscribe={handleSubscribe}
      />

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
      />
    </>
  )
}
