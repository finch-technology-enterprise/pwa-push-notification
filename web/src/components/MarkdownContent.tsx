import { useMemo } from 'react'
import { useRemark } from 'react-remark'
import { Typography } from '@mui/material'

interface MarkdownContentProps {
  content: string
  variant?: 'body1' | 'body2'
}

export function MarkdownContent({ content, variant = 'body1' }: MarkdownContentProps) {
  const [reactContent, setMarkdown] = useRemark()

  useMemo(() => {
    setMarkdown(content || '')
  }, [content, setMarkdown])

  if (!content) return null

  return (
    <Typography
      variant={variant}
      component="div"
      sx={{
        '& p': { margin: 0 },
        '& p + p': { marginTop: 1 },
        '& code': {
          backgroundColor: 'rgba(0,0,0,0.06)',
          borderRadius: 0.5,
          padding: '1px 4px',
          fontSize: '0.85em',
          fontFamily: 'monospace',
        },
        '& pre': {
          backgroundColor: 'rgba(0,0,0,0.06)',
          borderRadius: 1,
          padding: 1.5,
          overflow: 'auto',
          fontSize: '0.85em',
          fontFamily: 'monospace',
        },
        '& a': { color: 'primary.main' },
        '& ul, & ol': { paddingLeft: 2.5 },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'primary.main',
          marginLeft: 0,
          paddingLeft: 2,
          opacity: 0.8,
        },
        '& img': { maxWidth: '100%', borderRadius: 1 },
        '& h1, & h2, & h3, & h4': { margin: '0.5em 0' },
      }}
    >
      {reactContent}
    </Typography>
  )
}
