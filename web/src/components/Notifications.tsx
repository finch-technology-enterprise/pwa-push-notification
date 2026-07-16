import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Collapse,
} from '@mui/material'
import AccessTime from '@mui/icons-material/AccessTime'
import ContentCopy from '@mui/icons-material/ContentCopy'
import Delete from '@mui/icons-material/Delete'
import OpenInNew from '@mui/icons-material/OpenInNew'
import PriorityHigh from '@mui/icons-material/PriorityHigh'
import LowPriority from '@mui/icons-material/LowPriority'
import { PriorityIndicator, TagChip, EmptyState, NotificationCard } from './styles'
import { MarkdownContent } from './MarkdownContent'
import { AttachmentIcon } from './AttachmentIcon'
import type { StoredNotification } from '../app/db'
import subscriptionManager from '../app/SubscriptionManager'
import { formatRelativeTime, formatSize } from '../app/utils'
import { NTFY_COLORS } from '../app/theme'
import { NTFY_GREEN } from './theme'

interface NotificationsProps {
  topic?: string
}

export function Notifications({ topic }: NotificationsProps) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<StoredNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const items = await subscriptionManager.getNotifications(topic, 100)
      setNotifications(items)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
    setLoading(false)
  }, [topic])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 3000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const handleDelete = useCallback(
    async (id: string) => {
      await subscriptionManager.deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    },
    [],
  )

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
    subscriptionManager.markAsRead(topic || '')
  }, [topic])

  const handleAttachment = useCallback((url?: string) => {
    if (url) window.open(url, '_blank')
  }, [])

  const renderTagEmoji = (tag: string) => {
    if (tag.startsWith('http')) {
      return <TagChip key={tag} label={tag} size="small" variant="outlined" />
    }
    const emojiMatch = tag.match(
      /[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/u,
    )
    if (emojiMatch) {
      return <TagChip key={tag} label={emojiMatch[0]} size="small" />
    }
    return <TagChip key={tag} label={tag} size="small" variant="outlined" />
  }

  if (!loading && notifications.length === 0) {
    return (
      <EmptyState sx={{ flex: 1, overflow: 'auto' }}>
        <BellIcon sx={{ fontSize: 48, mb: 2, color: 'text.disabled' }} />
        <Typography variant="h6" color="text.secondary">
          {topic ? `No notifications for #${topic}` : 'No notifications yet'}
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
          {topic
            ? 'Publish a message to this topic to see it here'
            : 'Subscribe to a topic from the sidebar'}
        </Typography>
      </EmptyState>
    )
  }

  return (
    <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
      {notifications.map((n) => {
        const priority = n.priority || 3
        const att = n.attachment
          ? (() => {
              try {
                return JSON.parse(n.attachment!)
              } catch {
                return null
              }
            })()
          : null
        const isExpanded = expanded[n.id] || false

        return (
          <NotificationCard
            key={n.id}
            onClick={() => handleToggleExpand(n.id)}
          >
            <Box sx={{ display: 'flex' }}>
              <PriorityIndicator priority={priority} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {n.title && (
                        <Typography variant="subtitle2" noWrap fontWeight={600}>
                          {n.title}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        {n.topic && (
                          <Chip
                            label={`#${n.topic}`}
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/${n.topic}`)
                            }}
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <AccessTime sx={{ fontSize: 12, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.disabled">
                            {formatRelativeTime(n.time)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {att && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAttachment(att?.url)
                          }}
                        >
                          <AttachmentIcon
                            contentType={att?.type}
                            fileName={att?.name}
                          />
                        </IconButton>
                      )}
                      <Tooltip title="Copy message">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(n.message || '')
                          }}
                        >
                          <ContentCopy sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(n.id)
                          }}
                        >
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {n.tags && n.tags.length > 0 && (
                    <Box sx={{ mb: 0.5 }}>{n.tags.map(renderTagEmoji)}</Box>
                  )}

                  <Collapse in={isExpanded} collapsedSize={48}>
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        ...(isExpanded ? {} : {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }),
                      }}
                    >
                      {n.message || (
                        <Typography variant="body2" color="text.disabled" fontStyle="italic">
                          No message body
                        </Typography>
                      )}
                    </Typography>
                  </Collapse>

                  {isExpanded && n.message && (
                    <Box sx={{ mt: 1 }}>
                      <MarkdownContent content={n.message} variant="body2" />
                    </Box>
                  )}

                  {att && isExpanded && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <AttachmentIcon contentType={att.type} fileName={att.name} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {att.name || 'Attachment'}
                        </Typography>
                        {att.size && (
                          <Typography variant="caption" color="text.disabled">
                            {formatSize(att.size)}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        href={att.url}
                        target="_blank"
                        endIcon={<OpenInNew fontSize="small" />}
                      >
                        Open
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Box>
            </Box>
          </NotificationCard>
        )
      })}
    </Box>
  )
}

function BellIcon(props: Record<string, unknown>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
        fill="currentColor"
      />
    </svg>
  )
}
