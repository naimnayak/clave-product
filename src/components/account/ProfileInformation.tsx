import { Camera } from 'lucide-react'
import { useState } from 'react'
import { ProfileCover } from '@/components/account/AccountIllustrations'
import { AccountSection } from '@/components/account/AccountSection'
import { ChangePhotoModal } from '@/components/account/ChangePhotoModal'
import { VerifiedBadge } from '@/components/account/VerifiedBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  emailVerified: boolean
}

export function ProfileInformation({ emailVerified }: Props) {
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  if (!user) return null

  const startEditing = () => {
    setName(user.name)
    setEmail(user.email)
    setErrors({})
    setEditing(true)
  }

  const save = async () => {
    const next = { name: name.trim() ? undefined : 'Enter your name.', email: emailPattern.test(email.trim()) ? undefined : 'Enter a valid email address.' }
    setErrors(next)
    if (next.name || next.email) return
    const newEmail = email.trim().toLowerCase()
    const emailChanged = newEmail !== user.email
    setSaving(true)
    const saved = await updateUser({ name: name.trim(), email: newEmail })
    setSaving(false)
    if (!saved) return
    if (emailChanged) {
      toast.success('Check your inbox', `We sent a confirmation link to ${newEmail}. Your email changes once you open it.`)
    } else {
      toast.success('Profile updated')
    }
    setEditing(false)
  }

  return (
    <>
      <AccountSection
        title="Profile Information"
        description="This information is associated with your Clave account."
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPhotoOpen(true)}>
              Change photo
            </Button>
            {!editing && (
              <Button variant="tint" size="sm" onClick={startEditing}>
                Edit information
              </Button>
            )}
          </>
        }
      >
        <ProfileCover />
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="-mt-11 flex items-center gap-4 lg:w-[45%]">
            <span className="relative">
              <Avatar name={user.name} src={user.avatarUrl} size="xl" className="ring-4 ring-surface" />
              <button
                type="button"
                aria-label="Change photo"
                onClick={() => setPhotoOpen(true)}
                className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-tint text-primary-deep ring-1 ring-primary/20"
              >
                <Camera className="size-3.5" aria-hidden />
              </button>
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-text">{user.name}</p>
              <p className="mt-0.5 truncate text-sm text-secondary">{user.email}</p>
              <div className="mt-2">
                <VerifiedBadge verified={emailVerified} />
              </div>
            </div>
          </div>

          <form
            noValidate
            className="flex flex-1 flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <Input label="Full name" value={editing ? name : user.name} readOnly={!editing} error={errors.name} onChange={(event) => setName(event.target.value)} />
            <Input label="Email address" type="email" value={editing ? email : user.email} readOnly={!editing} error={errors.email} onChange={(event) => setEmail(event.target.value)} />
            {editing && (
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={saving}>
                  Save changes
                </Button>
              </div>
            )}
          </form>
        </div>
      </AccountSection>

      {photoOpen && <ChangePhotoModal onClose={() => setPhotoOpen(false)} />}
    </>
  )
}
