import { useState, useCallback } from 'react'
import {
  Popover,
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Tab,
  Tabs,
} from '@mui/material'
import Search from '@mui/icons-material/Search'
import InsertEmoticon from '@mui/icons-material/InsertEmoticon'

const EMOJI_CATEGORIES: Record<string, string[]> = {
  smileys: ['😀', '😂', '🤣', '😊', '😎', '🤩', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤔', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '💪'],
  objects: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💋', '💎', '🔔', '🔕', '🎁', '🎀', '📯', '📢', '📣', '🔊', '🔇', '💡', '🔦', '🏆', '🥇', '🥈', '🥉', '📱', '💻', '⌚️', '📷', '🔑', '🔒', '🔓', '💳', '📧', '✉️', '📨', '📩', '📤', '📥'],
  nature: ['☀️', '🌤', '⛅️', '🌥', '🌦', '🌈', '☁️', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️', '⛄️', '🔥', '💥', '✨', '⭐️', '🌟', '💫', '⚡️', '💧', '🌊', '🌸', '🌺', '🌻', '🌹', '🥀', '🌷', '🌿', '🍀', '🌵', '🎄', '🌲', '🌳', '🍁', '🍂', '🍃'],
  food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🧄', '🧅', '🥔', '🍞', '🥖', '🥯', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🍿', '🥣', '🍲', '🍛', '🍜', '🍝', '🍠', '🍣', '🍤', '🥟', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '☕️', '🍵', '🥤', '🧃', '🍺', '🍻', '🥂', '🍷', '🥃'],
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [category, setCategory] = useState('smileys')
  const [search, setSearch] = useState('')

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
  }, [])

  const handleClose = useCallback(() => {
    setAnchorEl(null)
    setSearch('')
  }, [])

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji)
      handleClose()
    },
    [onSelect, handleClose],
  )

  const filtered = search
    ? Object.values(EMOJI_CATEGORIES).flat().filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[category] || []

  return (
    <>
      <IconButton size="small" onClick={handleOpen}>
        <InsertEmoticon fontSize="small" />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Box sx={{ width: 300, height: 350, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1, pt: 1 }}>
            <TextField
              size="small"
              placeholder="Search emojis…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          {!search && (
            <Tabs
              value={category}
              onChange={(_, v) => setCategory(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0 } }}
            >
              {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                <Tab key={cat} value={cat} label={cat} />
              ))}
            </Tabs>
          )}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {filtered.map((emoji) => (
              <Box
                key={emoji}
                component="button"
                onClick={() => handleSelect(emoji)}
                sx={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 24,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)' },
                }}
              >
                {emoji}
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  )
}
