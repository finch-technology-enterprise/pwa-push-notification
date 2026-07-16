import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  IconButton,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import Add from '@mui/icons-material/Add'
import Close from '@mui/icons-material/Close'
import { TOPIC_REGEX } from '@ntfy-cf/shared'
import { disallowedTopics } from '../app/config'
import { NTFY_GREEN } from './theme'

interface SubscribeDialogProps {
  open: boolean
  onClose: () => void
  onSubscribe: (topic: string) => void
}

export function SubscribeDialog({ open, onClose, onSubscribe }: SubscribeDialogProps) {
  const [topic, setTopic] = useState('')
  const [activeStep, setActiveStep] = useState(0)

  const topicError = (() => {
    if (!topic.trim()) return ''
    if (!TOPIC_REGEX.test(topic.trim())) return 'Invalid topic name (1-64 characters, a-z, A-Z, 0-9, -, _)'
    if (disallowedTopics.includes(topic.trim().toLowerCase())) return 'This topic name is not allowed'
    return ''
  })()

  const handleNext = useCallback(() => {
    if (activeStep === 0 && !topicError && topic.trim()) {
      setActiveStep(1)
    }
  }, [activeStep, topicError, topic])

  const handleBack = useCallback(() => {
    setActiveStep(0)
  }, [])

  const handleSubscribe = useCallback(() => {
    if (topic.trim() && !topicError) {
      onSubscribe(topic.trim())
      setTopic('')
      setActiveStep(0)
      onClose()
    }
  }, [topic, topicError, onSubscribe, onClose])

  const handleClose = useCallback(() => {
    setTopic('')
    setActiveStep(0)
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Add sx={{ color: NTFY_GREEN }} />
        Subscribe to topic
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={handleClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>Topic</StepLabel>
          </Step>
          <Step>
            <StepLabel>Done</StepLabel>
          </Step>
        </Stepper>

        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter a topic name to subscribe to. Topics are case-sensitive and can contain
              letters, numbers, hyphens, and underscores.
            </Typography>
            <TextField
              label="Topic name"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              fullWidth
              autoFocus
              size="medium"
              error={!!topicError}
              helperText={topicError || 'e.g. mytopic, alerts, server_logs'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNext()
              }}
            />
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              You are now subscribed to <strong>{topic.trim()}</strong>
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Messages published to this topic will appear in your notification list.
              You can publish messages using the publish button or via the API.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {activeStep === 0 ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!topic.trim() || !!topicError}
              sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
            >
              Next
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleBack}>Back</Button>
            <Button
              variant="contained"
              onClick={handleSubscribe}
              sx={{ backgroundColor: NTFY_GREEN, '&:hover': { backgroundColor: '#2b6e62' } }}
            >
              Subscribe
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
