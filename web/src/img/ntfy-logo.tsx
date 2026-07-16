import type { SvgIconProps } from '@mui/material'

export function NtfyLogo(props: SvgIconProps) {
  return (
    <svg viewBox="0 0 120 32" fill="none" {...props}>
      <path
        d="M12 28c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 6.36 6 8.93 6 12v5l-2 2v1h16v-1l-2-2z"
        fill="#317f6f"
      />
      <text
        x="24"
        y="22"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="20"
        fontWeight="700"
        fill="currentColor"
      >
        ntfy
      </text>
    </svg>
  )
}
