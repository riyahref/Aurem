'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { getPromptById } from '@/lib/prompts'
import PostTypePicker, { PostType } from '@/components/editor/PostTypePicker'
import WriteEditor from '@/components/editor/WriteEditor'

const TAG_OPTIONS = [
  'Burnout',
  'Heartbreak',
  'Career',
  'Body',
  'Sisterhood',
  'Relationships',
  'Work',
  'Identity',
  'Family',
  'Sexuality',
  'Grief',
  'Anger',
  'Joy',
  'Anxiety',
  'Feminism',
  'Motherhood',
  'Friendship',
  'Solidarity',
  'Growth',
  'Writing',
]

const MAX_TAGS = 5
const WORD_LIMITS: Record<PostType, number> = {
  Story: 10000,
  Rant: 1000,
  Confess: 500,
}

type DraftSnapshot = {
  title: string
  content: string
  postType: PostType
  selectedTags: string[]
  contentWarning: boolean
  featuredImageUrl: string
}

type StoredDraft = DraftSnapshot & {
  savedAt: string
}

function isPostType(value: string | null): value is PostType {
  return value === 'Story' || value === 'Rant' || value === 'Confess'
}

function getInitialPostType(value: string | null): PostType {
  return isPostType(value) ? value : 'Story'
}

function createEmptyDraft(postType: PostType): DraftSnapshot {
  return {
    title: '',
    content: '',
    postType,
    selectedTags: [],
    contentWarning: false,
    featuredImageUrl: '',
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function countWords(html: string) {
  const text = stripHtml(html)
  if (!text) {
    return 0
  }

  return text.split(/\s+/).filter(Boolean).length
}

function serializeDraft(draft: DraftSnapshot) {
  return JSON.stringify(draft)
}

function isBlankDraft(draft: DraftSnapshot, defaultPostType: PostType) {
  return serializeDraft(draft) === serializeDraft(createEmptyDraft(defaultPostType))
}

function formatSavedAt(savedAt: string | null) {
  if (!savedAt) {
    return ''
  }

  try {
    return new Date(savedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function normalizeImageUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:') {
      return url.toString()
    }
  } catch {
    return ''
  }

  return ''
}

function getDraftStorageKey(userId: string, circleId: string | null, promptId: string | null) {
  return `fray:write-draft:v1:${userId}:${circleId ?? 'global'}:${promptId ?? 'noprompt'}`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read image file.'))
    }

    reader.onerror = () => reject(new Error('Unable to read image file.'))
    reader.readAsDataURL(file)
  })
}

export default function WritePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useState(() => createBrowserSupabaseClient())[0]

  const circleId = searchParams.get('circle_id')
  const typeParam = searchParams.get('type')
  const promptId = searchParams.get('prompt')
  const defaultPostType = getInitialPostType(typeParam)
  const selectedPrompt = promptId ? getPromptById(promptId) : null

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<PostType>(defaultPostType)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [contentWarning, setContentWarning] = useState(false)
  const [featuredImageUrl, setFeaturedImageUrl] = useState('')
  const [featuredImagePreviewUrl, setFeaturedImagePreviewUrl] = useState('')
  const [featuredImageFileName, setFeaturedImageFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [circleName, setCircleName] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    serializeDraft(createEmptyDraft(defaultPostType))
  )

  const featuredImageInputRef = useRef<HTMLInputElement | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  const wordCount = countWords(content)
  const wordLimit = WORD_LIMITS[postType]
  const wordOverflow = Math.max(0, wordCount - wordLimit)
  const currentDraftSnapshot = serializeDraft({
    title,
    content,
    postType,
    selectedTags,
    contentWarning,
    featuredImageUrl,
  })
  const isDirty = draftLoaded && currentDraftSnapshot !== lastSavedSnapshot
  const draftStatus = !draftLoaded
    ? 'Loading draft...'
    : isDirty
      ? 'Unsaved changes'
      : lastSavedAt
        ? `Saved ${formatSavedAt(lastSavedAt)}`
        : 'Autosave ready'

  const previewFeaturedImageUrl = normalizeImageUrl(featuredImagePreviewUrl || featuredImageUrl)

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }

      setCurrentUserId(data.user?.id ?? null)
      setAuthReady(true)
    }

    loadUser()

    return () => {
      mounted = false
    }
  }, [supabase])

  useEffect(() => {
    async function fetchCircle() {
      if (!circleId) {
        setCircleName(null)
        return
      }

      const { data } = await supabase.from('circles').select('name').eq('id', circleId).single()

      if (data) {
        setCircleName(data.name)
      }
    }

    fetchCircle()
  }, [circleId, supabase])

  useEffect(() => {
    async function loadDraft() {
      if (!authReady) {
        return
      }

      if (!currentUserId) {
        setLastSavedSnapshot(serializeDraft(createEmptyDraft(defaultPostType)))
        setDraftLoaded(true)
        return
      }

      try {
        const storageKey = getDraftStorageKey(currentUserId, circleId, promptId)
        const rawDraft = window.localStorage.getItem(storageKey)

        if (!rawDraft) {
          setLastSavedSnapshot(serializeDraft(createEmptyDraft(defaultPostType)))
          setLastSavedAt(null)
          setDraftLoaded(true)
          return
        }

        const parsed = JSON.parse(rawDraft) as Partial<StoredDraft>
        const parsedPostType = typeof parsed.postType === 'string' ? parsed.postType : null
        const restoredPostType: PostType = isPostType(parsedPostType) ? parsedPostType : defaultPostType
        const restoredDraft: DraftSnapshot = {
          title: typeof parsed.title === 'string' ? parsed.title : '',
          content: typeof parsed.content === 'string' ? parsed.content : '',
          postType: restoredPostType,
          selectedTags: Array.isArray(parsed.selectedTags)
            ? parsed.selectedTags.filter((tag): tag is string => typeof tag === 'string').slice(0, MAX_TAGS)
            : [],
          contentWarning: Boolean(parsed.contentWarning),
          featuredImageUrl: typeof parsed.featuredImageUrl === 'string' ? parsed.featuredImageUrl : '',
        }

        setTitle(restoredDraft.title)
        setContent(restoredDraft.content)
        setPostType(restoredDraft.postType)
        setSelectedTags(restoredDraft.selectedTags)
        setContentWarning(restoredDraft.contentWarning)
        setFeaturedImageUrl(restoredDraft.featuredImageUrl)
        setFeaturedImagePreviewUrl(restoredDraft.featuredImageUrl)
        setFeaturedImageFileName('')
        setLastSavedAt(typeof parsed.savedAt === 'string' ? parsed.savedAt : null)
        setLastSavedSnapshot(serializeDraft(restoredDraft))
        setDraftLoaded(true)
      } catch {
        setLastSavedSnapshot(serializeDraft(createEmptyDraft(defaultPostType)))
        setDraftLoaded(true)
      }
    }

    void loadDraft()
  }, [authReady, circleId, currentUserId, defaultPostType, promptId])

  useEffect(() => {
    if (!draftLoaded || !authReady || !currentUserId) {
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    const draft: DraftSnapshot = {
      title,
      content,
      postType,
      selectedTags,
      contentWarning,
      featuredImageUrl,
    }

    if (serializeDraft(draft) === lastSavedSnapshot) {
      return
    }

    saveTimerRef.current = window.setTimeout(() => {
      try {
        const storageKey = getDraftStorageKey(currentUserId, circleId, promptId)

        if (isBlankDraft(draft, defaultPostType)) {
          window.localStorage.removeItem(storageKey)
          setLastSavedSnapshot(serializeDraft(createEmptyDraft(defaultPostType)))
          setLastSavedAt(null)
          return
        }

        const savedAt = new Date().toISOString()
        const storedDraft: StoredDraft = {
          ...draft,
          savedAt,
        }

        window.localStorage.setItem(storageKey, JSON.stringify(storedDraft))
        setLastSavedSnapshot(serializeDraft(draft))
        setLastSavedAt(savedAt)
      } catch {
        // Autosave failures should not block writing.
      }
    }, 650)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [
    authReady,
    circleId,
    content,
    contentWarning,
    currentUserId,
    defaultPostType,
    draftLoaded,
    featuredImageUrl,
    postType,
    promptId,
    selectedTags,
    title,
    lastSavedSnapshot,
  ])

  useEffect(() => {
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnOnUnload)

    return () => {
      window.removeEventListener('beforeunload', warnOnUnload)
    }
  }, [isDirty])

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((currentTag) => currentTag !== tag))
      return
    }

    if (selectedTags.length < MAX_TAGS) {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handlePostTypeChange = (nextType: PostType) => {
    setPostType(nextType)

    if (nextType !== 'Confess') {
      setContentWarning(false)
    }

    if (nextType !== 'Story') {
      setFeaturedImageUrl('')
      setFeaturedImagePreviewUrl('')
      setFeaturedImageFileName('')
      if (featuredImageInputRef.current) {
        featuredImageInputRef.current.value = ''
      }
    }
  }

  const handleFeaturedImageSelect = async (file: File | null) => {
    if (!file) {
      setFeaturedImagePreviewUrl('')
      setFeaturedImageFileName('')
      setFeaturedImageUrl('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setError(null)
      setFeaturedImagePreviewUrl(dataUrl)
      setFeaturedImageFileName(file.name)
      setFeaturedImageUrl('')
    } catch (readError) {
      console.error(readError)
      setError('Unable to load that image file.')
    }
  }

  const clearFeaturedImage = () => {
    setFeaturedImagePreviewUrl('')
    setFeaturedImageFileName('')
    setFeaturedImageUrl('')
    if (featuredImageInputRef.current) {
      featuredImageInputRef.current.value = ''
    }
  }

  const handleDiscardDraft = () => {
    const emptyDraft = createEmptyDraft(defaultPostType)
    setTitle(emptyDraft.title)
    setContent(emptyDraft.content)
    setPostType(emptyDraft.postType)
    setSelectedTags(emptyDraft.selectedTags)
    setContentWarning(emptyDraft.contentWarning)
    setFeaturedImageUrl(emptyDraft.featuredImageUrl)
    setFeaturedImagePreviewUrl('')
    setFeaturedImageFileName('')
    setError(null)
    setLastSavedAt(null)
    setLastSavedSnapshot(serializeDraft(emptyDraft))

    if (featuredImageInputRef.current) {
      featuredImageInputRef.current.value = ''
    }

    if (currentUserId) {
      try {
        window.localStorage.removeItem(getDraftStorageKey(currentUserId, circleId, promptId))
      } catch {
        // Ignore storage cleanup issues.
      }
    }
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripHtml(content)) {
      setError('The typewriter parchment is empty. Please write some content.')
      return
    }

    if (wordOverflow > 0) {
      setError(`This ${postType.toLowerCase()} is over the ${wordLimit}-word limit by ${wordOverflow} words.`)
      return
    }

    if (postType === 'Confess' && !contentWarning) {
      setError('Confessions require a content warning before publishing.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim() || 'Untitled',
          content,
          post_type: postType,
          tags: selectedTags,
          circle_id: circleId || null,
          content_warning: postType === 'Confess' ? contentWarning : false,
          featured_image_url: postType === 'Story' ? normalizeImageUrl(previewFeaturedImageUrl || featuredImageUrl) : '',
          prompt_id: selectedPrompt?.id ?? null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to publish post.')
        return
      }

      if (currentUserId) {
        try {
          window.localStorage.removeItem(getDraftStorageKey(currentUserId, circleId, promptId))
        } catch {
          // Ignore storage cleanup issues.
        }
      }

      setLastSavedSnapshot(serializeDraft(createEmptyDraft(defaultPostType)))

      if (circleId) {
        router.push('/circles')
      } else {
        router.push('/')
      }

      router.refresh()
    } catch (publishError: unknown) {
      const message = publishError instanceof Error ? publishError.message : 'An error occurred while publishing.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const previewHtml = content.trim()
    ? content
    : '<p class="text-zinc-400 italic">Your live preview will appear here as you write.</p>'

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <header className="mb-8 border-b-4 border-ink pb-4">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-burgundy">
          Forge a Post
        </h1>
        <p className="font-display italic text-zinc-600 mt-1">
          {circleName
            ? `Publishing draft inside circle: ${circleName}`
            : 'Set ink to paper and broadcast to the feeds.'}
        </p>
      </header>

      {selectedPrompt && (
        <section className="mb-8 card-retro border-2 border-ink bg-[#FAF6EB] p-5 shadow-[4px_4px_0px_var(--ink)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                {selectedPrompt.scope === 'circle' ? 'Circle prompt' : 'Weekly prompt'}
              </p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase leading-tight text-burgundy">
                {selectedPrompt.title}
              </h2>
              <p className="mt-2 text-sm font-serif leading-relaxed text-zinc-700">
                {selectedPrompt.body}
              </p>
            </div>
            <Link
              href={`/prompts/${selectedPrompt.id}`}
              className="btn-retro-secondary text-xs uppercase font-bold self-start"
            >
              Open prompt archive
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_360px] lg:items-start">
        <form onSubmit={handlePublish} className="space-y-6">
          {error && (
            <div className="p-3 text-sm font-bold text-burgundy bg-rose/20 border-2 border-burgundy rounded card-retro">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded border-2 border-ink bg-[#FAF6EB] px-4 py-3 shadow-[3px_3px_0px_var(--ink)]">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <span className="rounded-full border border-ink/20 bg-cream px-3 py-1 text-ink">
                {draftStatus}
              </span>
              <span className="rounded-full border border-ink/20 bg-cream px-3 py-1 text-ink">
                {wordCount} / {wordLimit} words
              </span>
              {postType === 'Confess' && (
                <span className="rounded-full border border-burgundy/40 bg-rose/20 px-3 py-1 text-burgundy">
                  Anonymous mode
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="rounded border border-ink/60 bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 opacity-80 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              Discard draft
            </button>
          </div>

          <PostTypePicker selected={postType} onChange={handlePostTypeChange} />

          <div className="flex flex-col">
            <label htmlFor="title" className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
              Draft Title
            </label>
            <input
              id="title"
              type="text"
              className="input-retro text-lg font-bold"
              placeholder="Give it a vintage headline..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {postType === 'Story' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-display text-sm font-bold uppercase mb-1 tracking-wide block">
                  Featured Image
                </label>
                <p className="text-xs text-zinc-600">
                  Upload a cover image from your device. If you skip this, the story will publish without a cover image.
                </p>
              </div>

              <input
                ref={featuredImageInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void handleFeaturedImageSelect(event.target.files?.[0] ?? null)
                }}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => featuredImageInputRef.current?.click()}
                  className="btn-retro-secondary px-4 py-2 text-xs uppercase tracking-wider font-bold"
                >
                  Browse files
                </button>
                {(featuredImagePreviewUrl || featuredImageUrl) && (
                  <button
                    type="button"
                    onClick={clearFeaturedImage}
                    className="text-xs font-bold uppercase tracking-wider text-burgundy hover:underline"
                  >
                    Remove image
                  </button>
                )}
                {featuredImageFileName && (
                  <span className="text-xs font-mono text-zinc-600">
                    Selected file: {featuredImageFileName}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <label className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
              Body Copy
            </label>
            <WriteEditor
              content={content}
              onChange={setContent}
              placeholder="Type your story, rant, or confession here..."
            />
            <p className="mt-2 text-xs text-zinc-600">
              {postType === 'Confess'
                ? 'Confess is limited to 500 words.'
                : postType === 'Rant'
                  ? 'Rant is limited to 1,000 words.'
                  : 'Story is limited to 10,000 words.'}
            </p>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <label className="font-display text-sm font-bold uppercase tracking-wide">
                Associate Coordinates (Tags)
              </label>
              <span className="text-xs font-bold text-burgundy">
                Selected: {selectedTags.length} / {MAX_TAGS}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => {
                const isSelected = selectedTags.includes(tag)
                const disabled = !isSelected && selectedTags.length >= MAX_TAGS

                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1.5 text-xs font-bold border-2 rounded-full uppercase tracking-wider transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gold text-ink border-ink scale-[1.02] shadow-[2px_2px_0px_var(--ink)]'
                        : disabled
                          ? 'bg-zinc-200 text-zinc-400 border-zinc-300 opacity-50 cursor-not-allowed'
                          : 'bg-[#FAF6EB] text-ink border-ink hover:translate-y-[-1px]'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4 border-2 border-ink bg-[#FAF6EB] rounded flex flex-col gap-3 card-retro">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-sm font-bold uppercase text-burgundy">
                  Content Warning
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Required for Confess posts and recommended for anything sensitive.
                </p>
              </div>
              {postType === 'Confess' && (
                <span className="rounded-full border border-burgundy bg-rose/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-burgundy">
                  Required
                </span>
              )}
            </div>
            <select
              value={contentWarning ? 'yes' : 'no'}
              onChange={(event) => setContentWarning(event.target.value === 'yes')}
              className="input-retro text-sm font-bold uppercase tracking-wider"
            >
              <option value="no">No warning</option>
              <option value="yes">Sensitive content</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t-2 border-ink/10">
            <button
              type="submit"
              disabled={loading}
              className="btn-retro flex-1 text-lg py-3 uppercase tracking-wider font-bold"
            >
              {loading ? 'Transmitting Draft...' : 'Publish Draft'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded border-2 border-ink bg-cream px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-600 shadow-none transition-colors hover:bg-zinc-100 hover:shadow-[1px_1px_0px_var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="card-retro border-2 border-ink bg-[#F8F1E3] shadow-[4px_4px_0px_var(--ink)]">
            <div className="border-b-2 border-ink/10 px-5 py-4">
              <p className="font-display text-lg font-bold uppercase text-burgundy">
                Live Preview
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                What readers will see
              </p>
            </div>
            <div className="space-y-4 px-5 py-5">
              {postType === 'Story' && previewFeaturedImageUrl && (
                <div className="overflow-hidden rounded border-2 border-ink bg-[#F4E7D8] shadow-[3px_3px_0px_var(--ink)]">
                  <img
                    src={previewFeaturedImageUrl}
                    alt={title.trim() || 'Featured story cover'}
                    className="h-44 w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border-2 border-ink bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">
                  {postType}
                </span>
                {circleName && (
                  <span className="rounded-full border-2 border-ink bg-[#FAF6EB] px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">
                    Circle: {circleName}
                  </span>
                )}
                {postType === 'Confess' && (
                  <span className="rounded-full border-2 border-burgundy bg-rose/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-burgundy">
                    Anonymous
                  </span>
                )}
                {contentWarning && (
                  <span className="rounded-full border-2 border-burgundy bg-rose/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-burgundy">
                    Content warning
                  </span>
                )}
              </div>

              <h2 className="font-display text-3xl font-black uppercase leading-tight text-burgundy">
                {title.trim() || 'Untitled'}
              </h2>

              <div
                className="prose prose-zinc max-w-none text-base leading-relaxed text-ink"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />

              <div className="border-t-2 border-ink/10 pt-4">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                  Tags
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTags.length > 0 ? (
                    selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border-2 border-ink bg-[#FAF6EB] px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500">No tags selected yet.</span>
                  )}
                </div>
              </div>

              <div className="border-t-2 border-ink/10 pt-4 text-sm text-zinc-600">
                {wordOverflow > 0 ? (
                  <p className="font-bold text-burgundy">
                    You are {wordOverflow} words over the limit for this format.
                  </p>
                ) : (
                  <p>You have {wordLimit - wordCount} words left for this format.</p>
                )}
              </div>
            </div>
          </section>

          <section className="card-retro border-2 border-ink bg-[#FAF6EB] p-5 shadow-[4px_4px_0px_var(--ink)]">
            <p className="font-display text-lg font-bold uppercase text-burgundy">Composer Notes</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              <li>Drafts save locally for the current account, circle, and prompt.</li>
              <li>Confess posts stay anonymous by default.</li>
              <li>Preview updates live as you type.</li>
              {selectedPrompt && <li>This draft will be tagged with the selected prompt.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
