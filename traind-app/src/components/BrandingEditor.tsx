import React, { useState, useRef } from 'react'
import { FirestoreService, type Organization, type MediaItem } from '../lib/firestore'
import { StorageService } from '../lib/storageService'
import { resizeLogo, resizeSignature } from '../lib/imageResize'
import { ThemeEditor, type ThemeEditorData } from './ThemeEditor'
import { getThemePreset } from '../lib/themePresets'
import { MediaUploader } from './MediaUploader'
import {
  ImageIcon,
  Film,
  Smile,
  PenTool,
  Upload,
  Loader2,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { BUILT_IN_ANIMATIONS, ANIMATION_CATEGORIES, type BuiltInAnimation } from '../lib/builtInAnimations'

interface BrandingEditorProps {
  orgId: string
  organization: Organization
  onUpdate?: () => void
}

export const BrandingEditor: React.FC<BrandingEditorProps> = ({ orgId, organization }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(
    organization?.branding?.logo
  )
  const [logoRounded, setLogoRounded] = useState(
    organization?.branding?.logoRounded ?? false
  )
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(
    organization?.branding?.signatureUrl
  )
  const [signerName, setSignerName] = useState(organization?.branding?.signerName || '')
  const [signerTitle, setSignerTitle] = useState(organization?.branding?.signerTitle || '')
  const [savingSignerInfo, setSavingSignerInfo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [reactions, setReactions] = useState<{
    correct?: MediaItem[]
    incorrect?: MediaItem[]
    celebration?: MediaItem[]
  }>(organization?.branding?.reactions || {})
  const [stickers, setStickers] = useState<MediaItem[]>(
    organization?.branding?.stickers || []
  )
  const [interstitialAnimations, setInterstitialAnimations] = useState<string[]>(
    organization?.branding?.interstitialAnimations || []
  )
  const [customAnimations, setCustomAnimations] = useState<MediaItem[]>(
    organization?.branding?.customAnimations || []
  )

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccessMsg(null)
    setUploadingLogo(true)
    try {
      const optimized = await resizeLogo(file)
      const url = await StorageService.uploadLogo(orgId, optimized)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, logo: url }
      } as any)
      setLogoUrl(url)
      setSuccessMsg('Logo saved successfully!')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setError(null)
    setSuccessMsg(null)
    setRemovingLogo(true)
    try {
      await StorageService.deleteLogo(orgId)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, logo: '' }
      } as any)
      setLogoUrl(undefined)
      setSuccessMsg('Logo removed.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to remove logo')
    } finally {
      setRemovingLogo(false)
    }
  }

  const handleLogoRoundedToggle = async (rounded: boolean) => {
    setLogoRounded(rounded)
    try {
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, logoRounded: rounded }
      } as any)
      document.documentElement.style.setProperty('--logo-border-radius', rounded ? '0.75rem' : '0')
      setSuccessMsg(rounded ? 'Rounded corners enabled.' : 'Rounded corners disabled.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setLogoRounded(!rounded)
      setError(err.message || 'Failed to update logo style')
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccessMsg(null)
    setUploading(true)
    try {
      const optimized = await resizeSignature(file)
      const url = await StorageService.uploadSignature(orgId, optimized)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, signatureUrl: url }
      } as any)
      setSignatureUrl(url)
      setSuccessMsg('Signature saved successfully!')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload signature')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSignatureRemove = async () => {
    setError(null)
    setSuccessMsg(null)
    setRemoving(true)
    try {
      await StorageService.deleteSignature(orgId)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, signatureUrl: '' }
      } as any)
      setSignatureUrl(undefined)
      setSuccessMsg('Signature removed.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to remove signature')
    } finally {
      setRemoving(false)
    }
  }

  const handleSaveSignerInfo = async () => {
    setError(null)
    setSuccessMsg(null)
    setSavingSignerInfo(true)
    try {
      await FirestoreService.updateOrganization(orgId, {
        branding: {
          ...organization.branding,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
        }
      } as any)
      setSuccessMsg('Signer details saved.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to save signer details')
    } finally {
      setSavingSignerInfo(false)
    }
  }

  const handleReactionUpload = async (
    category: 'correct' | 'incorrect' | 'celebration',
    id: string,
    mp4: File,
    thumbnail: File,
    label: string
  ) => {
    setError(null)
    try {
      const url = await StorageService.uploadReaction(orgId, category, id, mp4)
      const thumbnailUrl = await StorageService.uploadReactionThumbnail(orgId, category, id, thumbnail)
      const newItem: MediaItem = { id, url, thumbnailUrl, label }
      const updated = {
        ...reactions,
        [category]: [...(reactions[category] || []), newItem]
      }
      setReactions(updated)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, reactions: updated }
      } as any)
      setSuccessMsg('Reaction saved!')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload reaction')
    }
  }

  const handleReactionDelete = async (
    category: 'correct' | 'incorrect' | 'celebration',
    id: string
  ) => {
    setError(null)
    try {
      await StorageService.deleteReaction(orgId, category, id)
      const updated = {
        ...reactions,
        [category]: (reactions[category] || []).filter(r => r.id !== id)
      }
      setReactions(updated)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, reactions: updated }
      } as any)
      setSuccessMsg('Reaction removed.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete reaction')
    }
  }

  const handleStickerUpload = async (id: string, mp4: File, thumbnail: File, label: string) => {
    setError(null)
    try {
      const url = await StorageService.uploadSticker(orgId, id, mp4)
      const thumbnailUrl = await StorageService.uploadStickerThumbnail(orgId, id, thumbnail)
      const newItem: MediaItem = { id, url, thumbnailUrl, label }
      const updated = [...stickers, newItem]
      setStickers(updated)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, stickers: updated }
      } as any)
      setSuccessMsg('Sticker saved!')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload sticker')
    }
  }

  const handleStickerDelete = async (id: string) => {
    setError(null)
    try {
      await StorageService.deleteSticker(orgId, id)
      const updated = stickers.filter(s => s.id !== id)
      setStickers(updated)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, stickers: updated }
      } as any)
      setSuccessMsg('Sticker removed.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete sticker')
    }
  }

  const handleToggleBuiltIn = async (animId: string, enabled: boolean) => {
    setError(null)
    const updated = enabled
      ? [...interstitialAnimations, animId]
      : interstitialAnimations.filter(id => id !== animId)
    setInterstitialAnimations(updated)
    try {
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, interstitialAnimations: updated }
      } as any)
    } catch (err: any) {
      // Revert on failure
      setInterstitialAnimations(interstitialAnimations)
      setError(err.message || 'Failed to update animations')
    }
  }

  const handleAnimationUpload = async (id: string, mp4: File, thumbnail: File, label: string) => {
    setError(null)
    try {
      const url = await StorageService.uploadAnimation(orgId, id, mp4)
      const thumbnailUrl = await StorageService.uploadAnimationThumbnail(orgId, id, thumbnail)
      const newItem: MediaItem = { id, url, thumbnailUrl, label }
      const updated = [...customAnimations, newItem]
      setCustomAnimations(updated)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, customAnimations: updated }
      } as any)
      setSuccessMsg('Animation saved!')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload animation')
    }
  }

  const handleAnimationDelete = async (id: string) => {
    setError(null)
    try {
      await StorageService.deleteAnimation(orgId, id)
      const updated = customAnimations.filter(a => a.id !== id)
      setCustomAnimations(updated)
      await FirestoreService.updateOrganization(orgId, {
        branding: { ...organization.branding, customAnimations: updated }
      } as any)
      setSuccessMsg('Animation removed.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete animation')
    }
  }

  const presetId = organization?.branding?.themePreset || 'corporate-blue'

  return (
    <div>
      {successMsg && (
        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light-color, #dcfce7)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--success-color, #16a34a)' }}>
            {successMsg}
          </p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--error-light-color, #fee2e2)' }}>
          <p className="text-sm" style={{ color: 'var(--error-color)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Organization Logo */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center space-x-2 mb-4">
          <ImageIcon size={18} style={{ color: 'var(--primary-color)' }} />
          <h3 className="font-medium" style={{ color: 'var(--text-color)' }}>
            Organization Logo
          </h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary-color)' }}>
          Logo appears in navigation, presenter screens, participant pages, and certificates. Upload PNG, JPG, or WebP (max 2MB).
        </p>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoUpload}
          className="hidden"
        />

        {logoUrl ? (
          <div className="space-y-4">
            <div
              className="p-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--background-color)', border: '1px solid var(--border-color)' }}
            >
              <img
                src={logoUrl}
                alt="Organization logo"
                className="max-h-16 object-contain"
                style={{ borderRadius: logoRounded ? '0.75rem' : '0' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2"
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: 'var(--text-on-primary-color)',
                    opacity: uploadingLogo ? 0.7 : 1
                  }}
                >
                  {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span>{uploadingLogo ? 'Uploading...' : 'Replace'}</span>
                </button>
                <button
                  onClick={handleLogoRemove}
                  disabled={removingLogo}
                  className="px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-colors"
                  style={{
                    backgroundColor: 'var(--background-color)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--error-color)',
                    opacity: removingLogo ? 0.7 : 1
                  }}
                >
                  {removingLogo ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>{removingLogo ? 'Removing...' : 'Remove'}</span>
                </button>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={logoRounded}
                  onChange={(e) => handleLogoRoundedToggle(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--primary-color)' }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
                  Rounded corners
                </span>
              </label>
            </div>
          </div>
        ) : (
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="w-full p-8 rounded-lg border-2 border-dashed flex flex-col items-center space-y-2 transition-colors"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary-color)',
              opacity: uploadingLogo ? 0.7 : 1
            }}
          >
            {uploadingLogo ? (
              <Loader2 size={32} className="animate-spin" />
            ) : (
              <ImageIcon size={32} />
            )}
            <span className="text-sm font-medium">
              {uploadingLogo ? 'Uploading...' : 'Click to upload organization logo'}
            </span>
          </button>
        )}
      </div>

      {/* Theme Editor */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <h3 className="font-medium mb-2" style={{ color: 'var(--text-color)' }}>
          Theme
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary-color)' }}>
          Choose a preset or customize colors, fonts, and backgrounds.
        </p>

        <ThemeEditor
          initialData={{
            themePreset: presetId,
            colors: organization?.branding?.colors || getThemePreset(presetId).colors,
            typography: organization?.branding?.typography || getThemePreset(presetId).typography,
            background: organization?.branding?.background || getThemePreset(presetId).background,
            effects: organization?.branding?.effects || getThemePreset(presetId).effects,
          }}
          onPreview={() => {
            // Preview is a no-op in superuser context — we don't apply the tenant's theme to the admin UI
          }}
          onSave={async (data: ThemeEditorData) => {
            const preset = getThemePreset(data.themePreset)
            await FirestoreService.updateOrganization(orgId, {
              branding: {
                ...organization.branding,
                themePreset: data.themePreset,
                colors: data.colors,
                typography: data.typography,
                background: data.background,
                effects: data.effects,
                gameTheme: preset.gameTheme,
                primaryColor: data.colors.primary,
                secondaryColor: data.colors.secondary,
              }
            } as any)
            setSuccessMsg('Theme saved successfully!')
            setTimeout(() => setSuccessMsg(null), 4000)
          }}
        />
      </div>

      {/* Answer Reactions */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center space-x-2 mb-4">
          <Film size={18} style={{ color: 'var(--primary-color)' }} />
          <h3 className="font-medium" style={{ color: 'var(--text-color)' }}>
            Answer Reactions
          </h3>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary-color)' }}>
          Upload animated GIFs or MP4s that play during answer feedback. They appear behind the result card for 1.5 seconds.
        </p>
        <div className="space-y-6">
          <MediaUploader
            label="Correct Answer"
            description="Plays when a participant answers correctly (max 3)"
            items={reactions.correct || []}
            maxItems={3}
            onUpload={(id, mp4, thumb, label) => handleReactionUpload('correct', id, mp4, thumb, label)}
            onDelete={(id) => handleReactionDelete('correct', id)}
            mediaType="reaction"
          />
          <MediaUploader
            label="Incorrect Answer"
            description="Plays when a participant answers incorrectly (max 3)"
            items={reactions.incorrect || []}
            maxItems={3}
            onUpload={(id, mp4, thumb, label) => handleReactionUpload('incorrect', id, mp4, thumb, label)}
            onDelete={(id) => handleReactionDelete('incorrect', id)}
            mediaType="reaction"
          />
          <MediaUploader
            label="Celebration"
            description="Plays on quiz completion for high scorers (max 3)"
            items={reactions.celebration || []}
            maxItems={3}
            onUpload={(id, mp4, thumb, label) => handleReactionUpload('celebration', id, mp4, thumb, label)}
            onDelete={(id) => handleReactionDelete('celebration', id)}
            mediaType="reaction"
          />
        </div>
      </div>

      {/* Participant Avatars */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center space-x-2 mb-4">
          <Smile size={18} style={{ color: 'var(--primary-color)' }} />
          <h3 className="font-medium" style={{ color: 'var(--text-color)' }}>
            Participant Avatars
          </h3>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary-color)' }}>
          Upload custom animated stickers for participants to use as avatars. They appear alongside the default emoji options.
        </p>
        <MediaUploader
          label="Custom Stickers"
          description="Animated GIF or MP4 avatars (max 12)"
          items={stickers}
          maxItems={12}
          onUpload={handleStickerUpload}
          onDelete={handleStickerDelete}
          mediaType="sticker"
        />
      </div>

      {/* Animation Library */}
      <div
        className="p-6 rounded-xl mb-6"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles size={18} style={{ color: 'var(--primary-color)' }} />
          <h3 className="font-medium" style={{ color: 'var(--text-color)' }}>
            Interstitial Animations
          </h3>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary-color)' }}>
          Animations that trainers can place between quiz questions. Toggle built-in animations and upload custom ones.
        </p>

        {/* Built-in animations curation */}
        <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-color)' }}>
          Built-in Animations
        </h4>
        <div className="space-y-4 mb-6">
          {ANIMATION_CATEGORIES.map(cat => {
            const anims = BUILT_IN_ANIMATIONS.filter(a => a.category === cat.value)
            return (
              <div key={cat.value}>
                <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary-color)' }}>
                  {cat.label}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {anims.map(anim => {
                    const isEnabled = interstitialAnimations.includes(anim.id)
                    return (
                      <label
                        key={anim.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isEnabled ? 'var(--primary-color)' : 'var(--background-color)',
                          border: `1px solid ${isEnabled ? 'var(--primary-color)' : 'var(--border-color)'}`,
                          color: isEnabled ? 'var(--text-on-primary-color)' : 'var(--text-color)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleToggleBuiltIn(anim.id, e.target.checked)}
                          className="sr-only"
                        />
                        <span className="text-sm">{anim.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--text-secondary-color)' }}>
          {interstitialAnimations.length} of {BUILT_IN_ANIMATIONS.length} enabled
        </p>

        {/* Custom animation uploads */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <MediaUploader
            label="Custom Animations"
            description="Upload GIF or MP4 animations (max 5s, audio retained). Trainers can use these between quiz questions."
            items={customAnimations}
            maxItems={6}
            onUpload={handleAnimationUpload}
            onDelete={handleAnimationDelete}
            mediaType="animation"
          />
        </div>
      </div>

      {/* Certificate Signature */}
      <div
        className="p-6 rounded-xl"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center space-x-2 mb-4">
          <PenTool size={18} style={{ color: 'var(--primary-color)' }} />
          <h3 className="font-medium" style={{ color: 'var(--text-color)' }}>
            Certificate Signature
          </h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary-color)' }}>
          Upload a signature image (PNG, JPG, or WebP, max 2MB) to appear on attendance certificates above the signature line.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleSignatureUpload}
          className="hidden"
        />

        {signatureUrl ? (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--background-color)', border: '1px solid var(--border-color)' }}
            >
              <img
                src={signatureUrl}
                alt="Signature preview"
                className="max-h-20 object-contain"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2"
                style={{
                  backgroundColor: 'var(--primary-color)',
                  color: 'var(--text-on-primary-color)',
                  opacity: uploading ? 0.7 : 1
                }}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>{uploading ? 'Uploading...' : 'Replace'}</span>
              </button>
              <button
                onClick={handleSignatureRemove}
                disabled={removing}
                className="px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 transition-colors"
                style={{
                  backgroundColor: 'var(--background-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--error-color)',
                  opacity: removing ? 0.7 : 1
                }}
              >
                {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>{removing ? 'Removing...' : 'Remove'}</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full p-6 rounded-lg border-2 border-dashed flex flex-col items-center space-y-2 transition-colors"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary-color)',
              opacity: uploading ? 0.7 : 1
            }}
          >
            {uploading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Upload size={24} />
            )}
            <span className="text-sm font-medium">
              {uploading ? 'Uploading...' : 'Click to upload signature image'}
            </span>
          </button>
        )}

        {/* Signer Name & Title */}
        <div className="mt-6 pt-6 space-y-4" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-color)' }}>
              Signer Name
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--background-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-color)' }}>
              Title / Position <span style={{ color: 'var(--text-secondary-color)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={signerTitle}
              onChange={(e) => setSignerTitle(e.target.value)}
              placeholder="e.g. Training Manager"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--background-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
              }}
            />
          </div>
          <button
            onClick={handleSaveSignerInfo}
            disabled={savingSignerInfo}
            className="px-4 py-2 rounded-lg font-medium text-sm"
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'var(--text-on-primary-color)',
              opacity: savingSignerInfo ? 0.7 : 1,
            }}
          >
            {savingSignerInfo ? 'Saving...' : 'Save Signer Details'}
          </button>
        </div>

      </div>
    </div>
  )
}
