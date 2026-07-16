import type { SvgIconProps } from '@mui/material'

export function Priority1Icon(props: SvgIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
  )
}

export function Priority2Icon(props: SvgIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function Priority3Icon(props: SvgIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

export function Priority4Icon(props: SvgIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 17V7l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function Priority5Icon(props: SvgIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 17V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
    </svg>
  )
}
