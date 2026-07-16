import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  Chip,
  Stack,
  Collapse,
} from '@mui/material'
import Send from '@mui/icons-material/Send'
import Close from '@mui/icons-material/Close'
import ExpandMore from '@mui/icons-material/ExpandMore'
import AttachFile from '@mui/icons-material/AttachFile'
import { EmojiPicker } from './EmojiPicker'
import { publish, publishJson } from '../app/Api'
import userManager from '../app/UserManager'
import { messageSizeLimit } from '../app/config'
import { isTopicValid } from '../app/utils'
import { NTFY_GREEN } from './theme'

interface PublishDialogProps {
  open: boolean
  onClose: () => void
}

export function PublishDialog({ open, onClose }: PublishDialogProps) {
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(3)
  const [tags, setTags] = useState('')
  const [clickUrl, setClickUrl] = useState('')
  const [email, setEmail] = useState('')
  const [delay, setDelay] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSend = useCallback(async () => {
    if (!topic.trim() || !message.trim() || sending) return
    setSending(true)
    try {
      const token = await userManager.getToken('')
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const payload: Record<string, unknown> = {
        topic: topic.trim(),
        message: message.trim(),
      }

      if (title) payload.title = title
      if (priority !== 3) payload.priority = priority
      if (tagList.length) payload.tags = tagList
      if (clickUrl) payload.click = clickUrl
      if (email) payload.email = email
      if (delay) payload.delay = delay

      await publishJson(topic.trim(), payload, token || undefined)
      onClose()
      setMessage('')
      setTitle('')
      setTags('')
      setClickUrl('')
      setEmail('')
      setDelay('')
    } catch (err) {
      console.error('Failed to publish:', err)
    }
    setSending(false)
  }, [topic, message, title, priority, tags, clickUrl, email, delay, sending, onClose])

  const handleEmoji = useCallback((emoji: string) => {
    setMessage((prev) => prev + emoji)
  }, [])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Send sx={{ color: NTFY_GREEN }} />
        Publish message
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            fullWidth
            required
            size="small"
            helperText={topic && !isTopicValid(topic) ? 'Invalid topic name' : ''}
            error={!!topic && !isTopicValid(topic)}
          />
          <Box sx={{ position: 'relative' }}>
            <TextField
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
              required
              multiline
              minRows={3}
              maxRows={8}
              size="small"
              inputProps={{ maxLength: messageSizeLimit }}
            />
            <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
              <EmojiPicker onSelect={handleEmoji} />
            </Box>
          </Box>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            select
            fullWidth
            size="small"
          >
            <MenuItem value={1}>Min priority</MenuItem>
            <MenuItem value={2}>Low priority</MenuItem>
            <MenuItem value={3}>Default priority</MenuItem>
            <MenuItem value={4}>High priority</MenuItem>
            <MenuItem value={5}>Urgent</MenuItem>
          </TextField>
          <TextField
            label="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            fullWidth
            size="small"
            placeholder="tag1, tag2, :emoji:"
          />
          <Button
            size="small"
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={<ExpandMore sx={{ transform: showAdvanced ? 'rotate(180deg)' : 'none' }} />}
          >
            Advanced
          </Button>
          <Collapse in={showAdvanced}>
            <Stack spacing={2}>
              <TextField
                label="Click URL"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                size="small"
                type="email"
              />
              <TextField
                label="Delay (e.g. 30m, 1h)"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                fullWidth
                size="small"
                placeholder="30m, 1h, tomorrow 9am"
              />
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!topic.trim() || !message.trim() || sending}
          startIcon={<Send />}
          sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
        >
          {sending ? 'Sending…' : 'Publish'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
