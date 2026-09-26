import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

const MAX_BYTES = 1_000_000
const AVATAR_PX = 256

/**
 * Center-crops to a square (the avatar renders with object-cover, so it looks the same) and scales
 * down to 256px JPEG. The photo travels with the account on every sign-in, so it has to stay small.
 */
function toAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(image.naturalWidth, image.naturalHeight)
      const size = Math.min(AVATAR_PX, side)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context || side === 0) return reject(new Error('Unreadable image'))
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, size, size)
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.86))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unreadable image'))
    }
    image.src = url
  })
}

/** The photo is saved on the account (PUT /api/me) as a small data URL; object storage can replace this later. */
export function ChangePhotoModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | undefined>(user?.avatarUrl)
  const [error, setError] = useState('')

  if (!user) return null

  const pick = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose an image file (PNG, JPG or WebP).')
    if (file.size > MAX_BYTES) return setError('Choose an image under 1 MB.')
    setError('')
    toAvatarDataUrl(file).then(setPreview, () => setError('We couldn’t read that image. Try a different one.'))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change photo"
      description="Your photo appears in the top bar and account menu."
      footer={
        <>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              onClick={async () => {
                if (!(await updateUser({ avatarUrl: undefined }))) return
                toast.success('Photo removed')
                onClose()
              }}
            >
              Remove photo
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!preview || preview === user.avatarUrl}
            onClick={async () => {
              if (!(await updateUser({ avatarUrl: preview }))) return
              toast.success('Photo updated')
              onClose()
            }}
          >
            Save photo
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <Avatar name={user.name} src={preview} size="xl" className="size-28 text-4xl" />
        <input ref={input} type="file" accept="image/*" className="sr-only" aria-label="Choose a photo" onChange={(event) => pick(event.target.files?.[0])} />
        <Button variant="secondary" leadingIcon={<ImagePlus className="size-4" />} onClick={() => input.current?.click()}>
          Choose image
        </Button>
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : <p className="text-xs text-muted">PNG, JPG or WebP, up to 1 MB.</p>}
      </div>
    </Modal>
  )
}
