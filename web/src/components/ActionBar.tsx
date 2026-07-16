import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationsOff from '@mui/icons-material/NotificationsOff'
import Notifications from '@mui/icons-material/Notifications'
import MoreVert from '@mui/icons-material/MoreVert'
import DoneAll from '@mui/icons-material/DoneAll'
import DeleteSweep from '@mui/icons-material/DeleteSweep'
import ContentCopy from '@mui/icons-material/ContentCopy'
import OpenInNew from '@mui/icons-material/OpenInNew'
import { GradientAppBar } from './styles'
import subscriptionManager from '../app/SubscriptionManager'
import { useNavigate } from 'react-router-dom'

interface ActionBarProps {
  topic?: string
  onMenuToggle: () => void
}

export function ActionBar({ topic, onMenuToggle }: ActionBarProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [muted, setMuted] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (topic) {
      subscriptionManager.getSubscription(topic).then((sub) => {
        setMuted(!!sub?.muted)
      })
    }
  }, [topic])

  const handleMute = useCallback(async () => {
    if (topic) {
      const sub = await subscriptionManager.getSubscription(topic)
      if (sub) {
        const newMuted = !muted
        await subscriptionManager.updateSubscription(topic, {
          muted: newMuted ? 1 : 0,
        })
        setMuted(newMuted)
      }
    }
  }, [topic, muted])

  const handleMarkAllRead = useCallback(async () => {
    if (topic) {
      await subscriptionManager.markAsRead(topic)
    } else {
      await subscriptionManager.markAllAsRead()
    }
  }, [topic])

  const handleClearAll = useCallback(async () => {
    if (topic) {
      await subscriptionManager.clearTopic(topic)
    } else {
      await subscriptionManager.clearAll()
    }
  }, [topic])

  const handleCopyTopic = useCallback(() => {
    if (topic) {
      navigator.clipboard.writeText(topic)
    }
    setAnchorEl(null)
  }, [topic])

  const handleOpenInNew = useCallback(() => {
    setAnchorEl(null)
  }, [])

  return (
    <GradientAppBar>
      <IconButton edge="start" color="inherit" onClick={onMenuToggle} sx={{ mr: 1 }}>
        <MenuIcon />
      </IconButton>

      <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, fontSize: 16 }}>
        {topic || 'All notifications'}
      </Typography>

      {topic && (
        <Tooltip title={muted ? 'Unmute' : 'Mute'}>
          <IconButton color="inherit" size="small" onClick={handleMute}>
            {muted ? <NotificationsOff /> : <Notifications />}
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="More">
        <IconButton color="inherit" size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <MoreVert />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleMarkAllRead}>
          <ListItemIcon>
            <DoneAll fontSize="small" />
          </ListItemIcon>
          <ListItemText>Mark all as read</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleClearAll}>
          <ListItemIcon>
            <DeleteSweep fontSize="small" />
          </ListItemIcon>
          <ListItemText>Clear all messages</ListItemText>
        </MenuItem>
        {topic && (
          <>
            <Divider />
            <MenuItem onClick={handleCopyTopic}>
              <ListItemIcon>
                <ContentCopy fontSize="small" />
              </ListItemIcon>
              <ListItemText>Copy topic name</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); window.open(`/${topic}`, '_blank') }}>
              <ListItemIcon>
                <OpenInNew fontSize="small" />
              </ListItemIcon>
              <ListItemText>Open in new tab</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </GradientAppBar>
  )
}
