'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import PostCard, { Post } from '@/components/feed/PostCard'

type ProfileData = {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  tags: string[] | null
  created_at: string | null
}

type CircleSummary = {
  id: string
  name: string
  slug: string
  description: string
  created_at: string
}

type ProfileTab = 'posts' | 'highlights' | 'circles'

function normalizeImageUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    return ''
  }

  return ''
}

function getJoinDateLabel(createdAt: string | null) {
  if (!createdAt) {
    return 'Joined quietly'
  }

  try {
    return `Joined ${new Date(createdAt).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })}`
  } catch {
    return 'Joined quietly'
  }
}

export default function UserProfile() {
  const params = useParams()
  const router = useRouter()
  const rawUsername = params.username as string
  const username = decodeURIComponent(rawUsername).toLowerCase()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [highlightPosts, setHighlightPosts] = useState<Post[]>([])
  const [memberCircles, setMemberCircles] = useState<CircleSummary[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [bioDraft, setBioDraft] = useState('')
  const [avatarUrlDraft, setAvatarUrlDraft] = useState('')

  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const loggedInUid = session?.user?.id || null
        setCurrentUserId(loggedInUid)

        const { data: targetProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, username, display_name, bio, avatar_url, tags, created_at')
          .eq('username', username)
          .single()

        if (profileErr || !targetProfile) {
          setError('Profile not found.')
          return
        }

        const normalizedProfile: ProfileData = {
          id: targetProfile.id,
          username: targetProfile.username,
          display_name: targetProfile.display_name ?? null,
          bio: targetProfile.bio ?? null,
          avatar_url: targetProfile.avatar_url ?? null,
          tags: targetProfile.tags ?? null,
          created_at: targetProfile.created_at ?? null,
        }

        setProfile(normalizedProfile)
        setDisplayNameDraft(normalizedProfile.display_name ?? '')
        setBioDraft(normalizedProfile.bio ?? '')
        setAvatarUrlDraft(normalizedProfile.avatar_url ?? '')

        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', targetProfile.id),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', targetProfile.id),
        ])

        setFollowersCount(followers || 0)
        setFollowingCount(following || 0)

        if (loggedInUid && loggedInUid !== targetProfile.id) {
          const { data: followRow } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', loggedInUid)
            .eq('following_id', targetProfile.id)
            .maybeSingle()

          setIsFollowing(!!followRow)
        }

        const { data: authorPosts, error: postsErr } = await supabase
          .from('posts')
          .select('*, profiles!posts_author_id_fkey(username, avatar_url)')
          .eq('author_id', targetProfile.id)
          .eq('is_published', true)
          .eq('is_anonymous', false)
          .order('created_at', { ascending: false })

        if (postsErr) {
          console.error(postsErr)
          setPosts([])
          setHighlightPosts([])
        } else {
          const visiblePosts = (authorPosts || []) as Post[]
          setPosts(visiblePosts)

          if (visiblePosts.length > 0) {
            const { data: reactions } = await supabase
              .from('reactions')
              .select('post_id')
              .in('post_id', visiblePosts.map((post) => post.id))

            const reactionCounts: Record<string, number> = {}
            reactions?.forEach((reaction) => {
              reactionCounts[reaction.post_id] = (reactionCounts[reaction.post_id] || 0) + 1
            })

            setHighlightPosts(
              [...visiblePosts]
                .sort((a, b) => {
                  const reactionsA = reactionCounts[a.id] || 0
                  const reactionsB = reactionCounts[b.id] || 0

                  if (reactionsA !== reactionsB) {
                    return reactionsB - reactionsA
                  }

                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
                .slice(0, 3)
            )
          } else {
            setHighlightPosts([])
          }
        }

        const { data: circleMemberships, error: membershipsErr } = await supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', targetProfile.id)

        if (membershipsErr) {
          console.error(membershipsErr)
          setMemberCircles([])
        } else {
          const circleIds = (circleMemberships ?? []).map((membership) => membership.circle_id)

          if (circleIds.length === 0) {
            setMemberCircles([])
          } else {
            const { data: circlesData, error: circlesErr } = await supabase
              .from('circles')
              .select('id, name, slug, description, created_at')
              .in('id', circleIds)
              .order('name', { ascending: true })

            if (circlesErr) {
              console.error(circlesErr)
              setMemberCircles([])
            } else {
              setMemberCircles((circlesData ?? []) as CircleSummary[])
            }
          }
        }
      } catch (err) {
        console.error(err)
        setError('Failed to fetch profile details.')
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      loadProfile()
    }
  }, [supabase, username])

  const handleFollowToggle = async () => {
    if (!currentUserId) {
      alert('Please log in to follow other creators!')
      return
    }

    if (!profile) return

    setFollowLoading(true)
    const originalFollowingState = isFollowing
    const originalFollowersCount = followersCount

    setIsFollowing(!isFollowing)
    setFollowersCount(isFollowing ? followersCount - 1 : followersCount + 1)

    try {
      if (originalFollowingState) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profile.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: profile.id,
        })

        if (error) throw error
      }
    } catch (err) {
      console.error(err)
      setIsFollowing(originalFollowingState)
      setFollowersCount(originalFollowersCount)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleProfileSave = async () => {
    if (!profile || !currentUserId || currentUserId !== profile.id) {
      return
    }

    setSavingProfile(true)
    setEditError(null)

    try {
      const nextAvatarUrl = normalizeImageUrl(avatarUrlDraft)
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayNameDraft.trim() || null,
          bio: bioDraft.trim() || null,
          avatar_url: nextAvatarUrl || null,
        })
        .eq('id', profile.id)

      if (error) {
        throw error
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              display_name: displayNameDraft.trim() || null,
              bio: bioDraft.trim() || null,
              avatar_url: nextAvatarUrl || null,
            }
          : current
      )
      setEditMode(false)
    } catch (err: any) {
      console.error(err)
      setEditError(err?.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const avatarInitial = useMemo(() => {
    return profile?.display_name?.[0] || profile?.username?.[0] || '?'
  }, [profile])

  if (loading) {
    return (
      <div className="py-12 text-center font-mono text-zinc-400 animate-pulse">
        Fetching profile data and logs...
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="card-retro p-8 text-center bg-[#FAF6EB]">
        <div className="text-3xl mb-3">🔍</div>
        <h3 className="font-display text-xl font-bold uppercase text-burgundy">
          Profile Unestablished
        </h3>
        <p className="text-sm font-serif text-zinc-600 mt-1">
          {error || 'This user card does not exist in the press registry.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="btn-retro text-xs mt-4 uppercase"
        >
          Return to Feed
        </button>
      </div>
    )
  }

  const isOwnProfile = currentUserId === profile.id
  const visiblePosts = activeTab === 'highlights' ? highlightPosts : posts

  return (
    <div className="flex flex-col gap-8">
      <header className="card-retro p-8 bg-[#FAF6EB] border-ink flex flex-col gap-6">
        <div className="flex flex-col gap-5 border-b-2 border-ink/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-ink bg-gold flex items-center justify-center font-display font-black text-3xl uppercase select-none shadow-[2px_2px_0px_var(--ink)]">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{avatarInitial}</span>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="font-display text-3xl font-black uppercase tracking-tight text-ink">
                {profile.display_name || `@${profile.username}`}
              </h1>
              <div className="font-mono text-xs font-bold text-zinc-500">
                @{profile.username} · {getJoinDateLabel(profile.created_at)}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <span className="rounded-full border border-ink/20 bg-cream px-3 py-1">
                  {followersCount} followers
                </span>
                <span className="rounded-full border border-ink/20 bg-cream px-3 py-1">
                  {followingCount} following
                </span>
                <span className="rounded-full border border-ink/20 bg-cream px-3 py-1">
                  {posts.length} public posts
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setEditMode((value) => !value)}
                className="btn-retro text-xs uppercase px-5 py-2.5 font-bold"
              >
                {editMode ? 'Close Editor' : 'Edit Profile'}
              </button>
            ) : currentUserId ? (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`btn-retro text-xs uppercase px-5 py-2.5 font-bold ${
                  isFollowing ? 'bg-ink text-cream hover:bg-zinc-800' : 'bg-burgundy text-cream'
                }`}
              >
                {isFollowing ? '✓ Following' : '✦ Follow'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            {editMode ? (
              <div className="space-y-4 rounded border-2 border-ink bg-cream p-4 shadow-[3px_3px_0px_var(--ink)]">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-display text-sm font-bold uppercase tracking-wide">
                      Display Name
                    </span>
                    <input
                      value={displayNameDraft}
                      onChange={(event) => setDisplayNameDraft(event.target.value)}
                      className="input-retro"
                      placeholder="Display name"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-display text-sm font-bold uppercase tracking-wide">
                      Avatar URL
                    </span>
                    <input
                      value={avatarUrlDraft}
                      onChange={(event) => setAvatarUrlDraft(event.target.value)}
                      className="input-retro"
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="font-display text-sm font-bold uppercase tracking-wide">
                    Bio
                  </span>
                  <textarea
                    value={bioDraft}
                    onChange={(event) => setBioDraft(event.target.value)}
                    className="input-retro min-h-28 resize-y"
                    placeholder="Write a short bio..."
                  />
                </label>

                {editError && (
                  <div className="rounded border-2 border-burgundy bg-rose/20 px-3 py-2 text-sm font-bold text-burgundy">
                    {editError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleProfileSave}
                    disabled={savingProfile}
                    className="btn-retro text-xs uppercase px-5 py-2.5 font-bold"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false)
                      setDisplayNameDraft(profile.display_name || '')
                      setBioDraft(profile.bio || '')
                      setAvatarUrlDraft(profile.avatar_url || '')
                      setEditError(null)
                    }}
                    className="btn-retro-secondary text-xs uppercase px-5 py-2.5 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {profile.bio ? (
                  <p className="text-sm font-serif italic text-zinc-700 leading-relaxed">
                    "{profile.bio}"
                  </p>
                ) : (
                  <p className="text-sm font-serif italic text-zinc-400">
                    This writer hasn't typed their bio yet.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 justify-center rounded border-2 border-ink bg-[#F8F1E3] p-4 shadow-[3px_3px_0px_var(--ink)]">
            <div className="text-[10px] font-mono font-black uppercase text-zinc-500 tracking-wider">
              Coordinates
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.tags && profile.tags.length > 0 ? (
                profile.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 border border-ink text-[9px] font-mono font-bold uppercase rounded bg-rose/20 text-burgundy"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-xs italic text-zinc-400 font-serif">None configured</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="card-retro p-4 bg-[#FAF6EB] border-ink">
        <div className="flex flex-wrap gap-2">
          {(['posts', 'highlights', 'circles'] as ProfileTab[]).map((tab) => {
            const isActive = activeTab === tab
            const label = tab === 'posts' ? 'Posts' : tab === 'highlights' ? 'Highlights' : 'Circles'

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 font-display text-sm font-black uppercase tracking-wider border-2 border-ink rounded-t-md cursor-pointer transition-all border-b-0 -mb-[2px] ${
                  isActive
                    ? 'bg-burgundy text-cream shadow-none translate-y-[2px]'
                    : 'bg-[#EAE3D2] text-ink hover:bg-[#FAF6EB]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4 border-b-4 border-ink pb-2">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-burgundy">
            {activeTab === 'highlights'
              ? 'Highlight Reel'
              : activeTab === 'circles'
                ? 'Member Circles'
                : 'The Public Record'}
          </h2>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            {activeTab === 'highlights'
              ? 'Top 3 visible posts by momentum'
              : activeTab === 'circles'
                ? 'All circles this user is a member of'
                : 'Published non-anonymous posts only'}
          </p>
        </div>

        {activeTab === 'circles' ? (
          memberCircles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {memberCircles.map((circle) => (
                <article
                  key={circle.id}
                  className="card-retro p-5 bg-[#FAF6EB] border-ink flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b-2 border-ink/10 pb-3">
                    <div>
                      <h3 className="font-display text-xl font-black uppercase tracking-tight text-burgundy">
                        {circle.name}
                      </h3>
                      <div className="text-xs font-mono text-zinc-500 mt-0.5">
                        /circles/{circle.slug}
                      </div>
                    </div>
                    <span className="badge-retro text-[9px] font-mono select-none">Circle</span>
                  </div>

                  <p className="text-sm font-serif text-zinc-700 leading-relaxed flex-1">
                    {circle.description}
                  </p>

                  <div className="pt-3 border-t-2 border-ink/10 mt-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/circles/${circle.slug}`)}
                      className="btn-retro-secondary text-xs py-2 px-4 uppercase font-bold flex-1"
                    >
                      View Circle
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card-retro p-12 text-center bg-[#FAF6EB]">
              <div className="text-3xl mb-2">🏟️</div>
              <h3 className="font-display text-lg font-bold uppercase text-burgundy">
                No Circles Yet
              </h3>
              <p className="text-xs font-serif text-zinc-600 max-w-xs mx-auto mt-1 leading-relaxed">
                This writer has not joined any circles yet. Browse the community directory to start reading locally.
              </p>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => router.push('/circles')}
                  className="btn-retro text-xs mt-4 uppercase font-bold"
                >
                  Browse Circles ✦
                </button>
              )}
            </div>
          )
        ) : visiblePosts.length > 0 ? (
          activeTab === 'posts' ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  onReactionUpdate={() => {}}
                  onPostDelete={() => router.refresh()}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  onReactionUpdate={() => {}}
                  onPostDelete={() => router.refresh()}
                />
              ))}
            </div>
          )
        ) : (
          <div className="card-retro p-12 text-center bg-[#FAF6EB]">
            <div className="text-3xl mb-2">📭</div>
            <h3 className="font-display text-lg font-bold uppercase text-burgundy">
              Record is Blank
            </h3>
            <p className="text-xs font-serif text-zinc-600 max-w-xs mx-auto mt-1 leading-relaxed">
              No public stories have been typeset by this writer. (Confessions are strictly withheld).
            </p>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => router.push('/write')}
                className="btn-retro text-xs mt-4 uppercase font-bold"
              >
                Forge a Post ✦
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
