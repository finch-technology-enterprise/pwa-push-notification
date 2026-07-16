import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { AuthContainer, AuthCard } from './styles'
import { NTFY_GREEN } from './theme'

interface AvatarBoxProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AvatarBox({ title, subtitle, children }: AvatarBoxProps) {
  return (
    <AuthContainer>
      <AuthCard>
        <Box textAlign="center" mb={3}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: NTFY_GREEN,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
              <path
                d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
                fill="white"
              />
            </svg>
          </Box>
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </AuthCard>
    </AuthContainer>
  )
}
