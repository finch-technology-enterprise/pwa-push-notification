import InsertDriveFile from '@mui/icons-material/InsertDriveFile'
import Image from '@mui/icons-material/Image'
import AudioFile from '@mui/icons-material/AudioFile'
import VideoFile from '@mui/icons-material/VideoFile'
import Description from '@mui/icons-material/Description'
import PictureAsPdf from '@mui/icons-material/PictureAsPdf'
import Archive from '@mui/icons-material/Archive'
import Code from '@mui/icons-material/Code'

interface AttachmentIconProps {
  contentType?: string
  fileName?: string
}

const iconMap: Array<[RegExp, typeof InsertDriveFile]> = [
  [/^image\//, Image],
  [/^audio\//, AudioFile],
  [/^video\//, VideoFile],
  [/^application\/pdf/, PictureAsPdf],
  [/^text\/html/, Code],
  [/^application\/(zip|gzip|x-tar|x-bzip|x-7z)/, Archive],
  [/^text\//, Description],
]

export function AttachmentIcon({ contentType, fileName }: AttachmentIconProps) {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  const extMap: Record<string, typeof InsertDriveFile> = {
    pdf: PictureAsPdf,
    zip: Archive,
    gz: Archive,
    tar: Archive,
    '7z': Archive,
    rar: Archive,
    js: Code,
    ts: Code,
    tsx: Code,
    jsx: Code,
    py: Code,
    css: Code,
    html: Code,
    json: Code,
    xml: Code,
    md: Description,
    txt: Description,
    csv: Description,
    jpg: Image,
    jpeg: Image,
    png: Image,
    gif: Image,
    webp: Image,
    svg: Image,
    mp3: AudioFile,
    wav: AudioFile,
    ogg: AudioFile,
    mp4: VideoFile,
    webm: VideoFile,
    mov: VideoFile,
  }

  if (contentType) {
    for (const [regex, Icon] of iconMap) {
      if (regex.test(contentType)) {
        return <Icon fontSize="small" />
      }
    }
  }

  if (ext && extMap[ext]) {
    const Icon = extMap[ext]
    return <Icon fontSize="small" />
  }

  return <InsertDriveFile fontSize="small" />
}
