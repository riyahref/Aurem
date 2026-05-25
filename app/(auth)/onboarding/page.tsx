'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const AVAILABLE_TAGS = [
  'Career',
  'Body',
  'Relationships',
  'Family',
  'Sexuality',
  'Identity',
  'Burnout',
  'Heartbreak',
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
  'Art',
  'Music',
  'Books',
  'Film',
]

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/
const MAX_TAGS = 5
const RECOMMENDED_TAGS = 3

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
}

function getUsernameError(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return 'Username is required.'
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username must be 3-20 characters and use only letters, numbers, and underscores.'
  }

  return null
}

export default function Onboarding() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const supabase = createBrowserSupabaseClient()
  const router = useRouter()

  const usernameError = useMemo(() => getUsernameError(username), [username])

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, bio, tags')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        setUsername(profile.username ?? '')
        setDisplayName(profile.display_name ?? '')
        setBio(profile.bio ?? '')
        setSelectedTags(Array.isArray(profile.tags) ? profile.tags : [])
      }

      setProfileLoaded(true)
    }

    loadProfile()
  }, [router, supabase])

  const findSuggestion = async (baseUsername: string) => {
    const cleanBase = baseUsername.trim().toLowerCase()

    for (let suffix = 1; suffix <= 25; suffix += 1) {
      const candidate = `${cleanBase}_${suffix}`
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', candidate)
        .maybeSingle()

      if (!data) {
        return candidate
      }
    }

    return `${cleanBase}_1`
  }

  const checkUsernameAvailability = async () => {
    const validationError = getUsernameError(username)

    if (validationError) {
      setUsernameStatus('invalid')
      setUsernameSuggestion(null)
      return false
    }

    if (!userId) {
      return false
    }

    setUsernameStatus('checking')
    setUsernameSuggestion(null)

    try {
      const normalized = username.trim().toLowerCase()
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .maybeSingle()

      if (error) {
        console.error(error)
        setUsernameStatus('invalid')
        return false
      }

      if (data && data.id !== userId) {
        setUsernameStatus('taken')
        setUsernameSuggestion(await findSuggestion(normalized))
        return false
      }

      setUsernameStatus('available')
      return true
    } catch (err) {
      console.error(err)
      setUsernameStatus('invalid')
      return false
    }
  }

  useEffect(() => {
    if (!profileLoaded) {
      return
    }

    if (!username.trim()) {
      setUsernameStatus('idle')
      setUsernameSuggestion(null)
      return
    }

    if (usernameError) {
      setUsernameStatus('invalid')
      setUsernameSuggestion(null)
      return
    }

    const timer = setTimeout(() => {
      void checkUsernameAvailability()
    }, 450)

    return () => clearTimeout(timer)
  }, [profileLoaded, username, usernameError])

  const handleTagToggle = (tag: string) => {
    setError(null)

    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((current) => current !== tag))
      return
    }

    if (selectedTags.length >= MAX_TAGS) {
      setError(`You can choose up to ${MAX_TAGS} interest tags.`)
      return
    }

    setSelectedTags([...selectedTags, tag])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId) {
      return
    }

    setError(null)

    const normalizedUsername = username.trim().toLowerCase()
    const validationError = getUsernameError(normalizedUsername)

    if (validationError) {
      setError(validationError)
      return
    }

    if (usernameStatus === 'taken') {
      setError(
        usernameSuggestion
          ? `That username is already taken. Try ${usernameSuggestion} instead.`
          : 'This username is already taken.'
      )
      return
    }

    const isAvailable = await checkUsernameAvailability()
    if (!isAvailable) {
      setError(
        usernameSuggestion
          ? `That username is already taken. Try ${usernameSuggestion} instead.`
          : 'This username is already taken.'
      )
      return
    }

    if (selectedTags.length < 1) {
      setError('Please select at least 1 interest tag.')
      return
    }

    if (selectedTags.length > MAX_TAGS) {
      setError(`Please select no more than ${MAX_TAGS} interest tags.`)
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            username: normalizedUsername,
            display_name: displayName.trim() || null,
            bio: bio.trim() || null,
            tags: selectedTags,
          },
          { onConflict: 'id' }
        )

      if (updateError) {
        setError(updateError.message)
        return
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    !loading &&
    selectedTags.length >= 1 &&
    selectedTags.length <= MAX_TAGS &&
    usernameStatus !== 'checking' &&
    !usernameError

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-cream text-ink">
      <header className="mb-6 text-center">
        <h1 className="font-display text-5xl tracking-tighter uppercase font-black text-burgundy select-none">
          Welcome to Fray
        </h1>
        <p className="font-display italic text-zinc-600 mt-2 max-w-sm">
          Choose a username, add a little context, and pick a few coordinates so the feed can start matching you properly.
        </p>
      </header>

      <div className="w-full max-w-2xl card-retro p-8">
        <h2 className="font-display text-2xl font-bold mb-6 text-burgundy text-center uppercase tracking-tight">
          Complete Onboarding
        </h2>

        {error && (
          <div className="p-3 mb-4 text-sm font-bold text-burgundy bg-rose/20 border-2 border-burgundy rounded">
            ✦ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="username" className="font-display text-sm font-bold uppercase tracking-wide">
                  Username
                </label>
                <span className="text-xs font-bold">
                  {usernameStatus === 'checking' && 'Checking...'}
                  {usernameStatus === 'available' && <span className="text-emerald-700">✦ Available</span>}
                  {usernameStatus === 'taken' && <span className="text-burgundy">✦ Taken</span>}
                </span>
              </div>
              <input
                id="username"
                type="text"
                required
                className="input-retro"
                placeholder="e.g. wanderer"
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                onBlur={() => void checkUsernameAvailability()}
              />
              <p className="text-xs text-zinc-600 mt-1">
                3-20 characters, letters, numbers, and underscores only.
              </p>
              {usernameSuggestion && usernameStatus === 'taken' && (
                <p className="text-xs text-zinc-600 mt-1">
                  Try <span className="font-bold text-burgundy">{usernameSuggestion}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <label htmlFor="display_name" className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
                Display Name
              </label>
              <input
                id="display_name"
                type="text"
                className="input-retro"
                placeholder="Optional public name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="bio" className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
              Bio
            </label>
            <textarea
              id="bio"
              className="input-retro min-h-[110px] resize-y"
              placeholder="Optional short bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={240}
            />
            <div className="mt-1 text-xs text-zinc-500">
              {bio.length}/240
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between items-baseline mb-3">
              <label className="font-display text-sm font-bold uppercase tracking-wide">
                Interest Tags
              </label>
              <span className="text-xs font-bold text-burgundy">
                Selected: {selectedTags.length} / {MAX_TAGS}
              </span>
            </div>
            <p className="text-xs text-zinc-600 mb-3">
              Choose at least 1, up to {MAX_TAGS}. 3 is the sweet spot for a strong first feed.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag)
                const disabled = !isSelected && selectedTags.length >= MAX_TAGS

                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleTagToggle(tag)}
                    className={`p-3 text-xs font-bold border-2 rounded text-center transition-all select-none uppercase tracking-tight shadow-sm cursor-pointer ${
                      isSelected
                        ? 'bg-burgundy text-cream border-ink scale-[1.03] shadow-md'
                        : disabled
                          ? 'bg-zinc-200 text-zinc-400 border-zinc-300 opacity-60 cursor-not-allowed'
                          : 'bg-[#FAF6EB] text-ink border-ink hover:translate-y-[-1px]'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`btn-retro w-full mt-4 uppercase font-bold text-lg tracking-wider ${
              !canSubmit
                ? 'opacity-50 cursor-not-allowed bg-zinc-400 hover:bg-zinc-400 hover:transform-none hover:shadow-sm'
                : ''
            }`}
          >
            {loading ? 'Setting up account...' : 'Enter Fray ✦'}
          </button>
        </form>
      </div>
    </div>
  )
}
