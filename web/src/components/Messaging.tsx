import { useState, useCallback } from 'react'
import { IconButton, TextField, Tooltip, Box } from '@mui/material'
import Send from '@mui/icons-material/Send'
import AttachFile from '@mui/icons-material/AttachFile'
import { EmojiPicker } from './EmojiPicker'
import { MessageInput } from './styles'
import { publish } from '../app/Api'
import userManager from '../app/UserManager'
import { messageSizeLimit } from '../app/config'
import { NTFY_GREEN } from './theme'

interface MessagingProps {
  topic: string
}

export function Messaging({ topic }: MessagingProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachFile, setAttachFile] = useState(false)

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const token = await userManager.getToken('')
      await publish(topic, text.trim(), 'text/plain', token || undefined)
      setText('')
    } catch (err) {
      console.error('Failed to send:', err)
    }
    setSending(false)
  }, [text, sending, topic])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleEmoji = useCallback(
    (emoji: string) => {
      setText((prev) => prev + emoji)
    },
    [],
  )

  return (
    <MessageInput>
      <EmojiPicker onSelect={handleEmoji} />
      <TextField
        fullWidth
        size="small"
        placeholder={`Message to #${topic}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        maxRows={4}
        inputProps={{ maxLength: messageSizeLimit }}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
            backgroundColor: 'action.hover',
          },
        }}
      />
      {attachFile && <input type="file" hidden />}
      <Tooltip title="Send">
        <span>
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            sx={{
              backgroundColor: NTFY_GREEN,
              color: '#fff',
              '&:hover': { backgroundColor: '#2b6e62' },
              '&.Mui-disabled': { backgroundColor: 'action.disabledBackground' },
            }}
          >
            <Send fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </MessageInput>
  )
}
