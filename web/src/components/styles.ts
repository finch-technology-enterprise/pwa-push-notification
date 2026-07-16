import { styled, alpha } from '@mui/material/styles'
import { Box, Card, Typography, IconButton, Chip } from '@mui/material'
import { NTFY_GREEN, NTFY_GREEN_DARK } from './theme'

export const GradientAppBar = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${NTFY_GREEN} 0%, ${NTFY_GREEN_DARK} 100%)`,
  color: '#fff',
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  minHeight: 56,
  position: 'sticky',
  top: 0,
  zIndex: 100,
}))

export const SidebarDrawer = styled(Box)(({ theme }) => ({
  width: 320,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#fafafa',
}))

export const SidebarHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${NTFY_GREEN} 0%, ${NTFY_GREEN_DARK} 100%)`,
  color: '#fff',
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}))

export const NotificationCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: NTFY_GREEN,
    boxShadow: `0 2px 8px ${alpha(NTFY_GREEN, 0.15)}`,
  },
}))

export const PriorityIndicator = styled(Box)<{ priority: number }>(({ priority, theme }) => {
  const colors: Record<number, string> = {
    1: '#9e9e9e',
    2: '#2196f3',
    3: theme.palette.mode === 'dark' ? '#e0e0e0' : '#212121',
    4: '#ff9800',
    5: '#f44336',
  }
  return {
    width: 4,
    minWidth: 4,
    borderRadius: 2,
    backgroundColor: colors[priority] || colors[3],
    marginRight: 12,
    alignSelf: 'stretch',
  }
})

export const TagChip = styled(Chip)(({ theme }) => ({
  height: 20,
  fontSize: 11,
  fontWeight: 600,
  margin: theme.spacing(0, 0.5, 0.5, 0),
}))

export const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.mode === 'dark' ? '#9e9e9e' : '#757575',
}))

export const AuthContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, #1a1a1a 0%, #121212 100%)'
    : `linear-gradient(135deg, ${NTFY_GREEN} 0%, ${NTFY_GREEN_DARK} 50%, #f5f5f5 100%)`,
  padding: theme.spacing(2),
}))

export const AuthCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 12,
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: 400,
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
}))

export const ConnectionStatusDot = styled(Box)<{ status: 'connected' | 'disconnected' | 'connecting' }>(
  ({ status }) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor:
      status === 'connected' ? '#4caf50' :
      status === 'connecting' ? '#ff9800' :
      '#f44336',
    flexShrink: 0,
  }),
)

export const MessageInput = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
}))

export const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8, 2),
  color: theme.palette.text.secondary,
}))
