'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { getActiveCirclePrompt } from '@/lib/prompts'
import PostCard, { Post } from '@/components/feed/PostCard'

interface Circle {
  id: string
  name: string
  slug: string
  description: string
  created_at: string
}

function getCircleBadge(circleName: string) {
  const seed = [...circleName].reduce((value, char) => (value * 17 + char.charCodeAt(0)) % 360, 0)
  const accent = (seed + 40) % 360
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${seed} 55% 84%), hsl(${accent} 55% 78%))`,
  }
}

export default function CircleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawSlug = params.slug as string
  const slug = decodeURIComponent(rawSlug).toLowerCase()

  const [circle, setCircle] = useState<Circle | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    async function loadCircleData() {
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const currentUid = session?.user?.id || null
        setUserId(currentUid)

        const { data: targetCircle, error: circErr } = await supabase
          .from('circles')
          .select('*')
          .eq('slug', slug)
          .single()

        if (circErr || !targetCircle) {
          setError('Circle not found.')
          return
        }

        setCircle(targetCircle)

        const { count: members } = await supabase
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('circle_id', targetCircle.id)

        setMemberCount(members || 0)

        if (currentUid) {
          const { data: memberRow } = await supabase
            .from('circle_members')
            .select('*')
            .eq('circle_id', targetCircle.id)
            .eq('user_id', currentUid)
            .maybeSingle()

          setIsMember(!!memberRow)
        }

        const { data: circlePosts, error: postsErr } = await supabase
          .from('posts')
          .select('*, profiles!posts_author_id_fkey(username, avatar_url)')
          .eq('circle_id', targetCircle.id)
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (postsErr) {
          console.error(postsErr)
          setPosts([])
        } else {
          const sanitizedPosts = (circlePosts || []).map((post) => {
            if (post.is_anonymous) {
              return {
                ...post,
                author_id: null,
                profiles: {
                  username: 'Anonymous',
                  avatar_url: null,
                },
              }
            }

            return post
          })

          setPosts(sanitizedPosts)
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load circle records.')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      loadCircleData()
    }
  }, [slug, supabase])

  const handleJoinToggle = async () => {
    if (!userId) {
      alert('Please log in to join circles!')
      return
    }

    if (!circle) return

    const originalMembership = isMember
    const originalCount = memberCount

    setJoinLoading(true)
    setIsMember(!isMember)
    setMemberCount(isMember ? memberCount - 1 : memberCount + 1)

    try {
      if (originalMembership) {
        const { error } = await supabase
          .from('circle_members')
          .delete()
          .eq('circle_id', circle.id)
          .eq('user_id', userId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('circle_members').insert({
          circle_id: circle.id,
          user_id: userId,
        })

        if (error) throw error
      }
    } catch (err) {
      console.error(err)
      setIsMember(originalMembership)
      setMemberCount(originalCount)
    } finally {
      setJoinLoading(false)
    }
  }

  const prompt = useMemo(() => {
    if (!circle) {
      return null
    }

    return getActiveCirclePrompt(circle.slug)
  }, [circle])

  const badgeStyle = useMemo(() => {
    if (!circle) {
      return {}
    }

    return getCircleBadge(circle.name)
  }, [circle])

  if (loading) {
    return (
      <div className="py-12 text-center font-mono text-zinc-400 animate-pulse">
        Opening circle files...
      </div>
    )
  }

  if (error || !circle) {
    return (
      <div className="card-retro p-8 text-center bg-[#FAF6EB]">
        <div className="text-3xl mb-3">🔍</div>
        <h3 className="font-display text-xl font-bold uppercase text-burgundy">
          Circle Unestablished
        </h3>
        <p className="text-sm font-serif text-zinc-600 mt-1">
          {error || 'This circle slug does not exist in the press logs.'}
        </p>
        <button
          onClick={() => router.push('/circles')}
          className="btn-retro text-xs mt-4 uppercase"
        >
          Browse Circles
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="card-retro p-8 bg-[#FAF6EB] border-ink flex flex-col gap-6">
        <div className="flex flex-col gap-5 border-b-2 border-ink/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="h-16 w-16 rounded-full border-4 border-ink flex items-center justify-center shadow-[2px_2px_0px_var(--ink)]"
              style={badgeStyle}
            >
              <span className="font-display font-black text-2xl uppercase select-none text-ink">
                {circle.name[0]}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-ink/20 bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                  Public circle
                </span>
                <span className="rounded-full border border-ink/20 bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                  {memberCount} members
                </span>
                <span className="rounded-full border border-ink/20 bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                  {posts.length} posts
                </span>
              </div>
              <h1 className="font-display text-3xl font-black uppercase tracking-tight text-burgundy">
                {circle.name}
              </h1>
              <div className="font-mono text-xs font-bold text-zinc-500">
                /circles/{circle.slug}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {userId && (
              <button
                onClick={handleJoinToggle}
                disabled={joinLoading}
                className={`btn-retro text-xs uppercase px-5 py-2.5 font-bold ${
                  isMember ? 'bg-ink text-cream hover:bg-zinc-800' : 'bg-burgundy text-cream'
                }`}
              >
                {joinLoading ? 'Working...' : isMember ? '✓ Leave Circle' : '✦ Join Circle'}
              </button>
            )}

            <Link
              href={`/write?circle_id=${circle.id}`}
              className="btn-retro-secondary text-xs uppercase px-5 py-2.5 font-bold"
            >
              Write Inside ✦
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <p className="text-sm font-serif text-zinc-700 leading-relaxed italic">
              "{circle.description}"
            </p>
            <div className="rounded border-2 border-ink bg-[#F8F1E3] p-4 shadow-[3px_3px_0px_var(--ink)]">
              <div className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                Weekly prompt
              </div>
              {prompt && (
                <>
                  <p className="mt-2 font-display text-2xl font-black uppercase leading-tight text-burgundy">
                    {prompt.title}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                    {prompt.body}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/write?circle_id=${circle.id}&prompt=${prompt.id}`}
                      className="btn-retro text-xs uppercase font-bold"
                    >
                      Respond inside this circle
                    </Link>
                    <Link
                      href={`/prompts/${prompt.id}`}
                      className="btn-retro-secondary text-xs uppercase font-bold"
                    >
                      View prompt archive
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded border-2 border-ink bg-[#F8F1E3] p-4 shadow-[3px_3px_0px_var(--ink)]">
              <div className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                Reading room
              </div>
              <div className="mt-3 flex items-center justify-between border-b border-ink/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Member status
                </span>
                <span className={`badge-retro ${isMember ? 'bg-ink text-cream' : 'bg-gold text-ink'}`}>
                  {isMember ? 'Joined' : 'Browsing'}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-700 leading-relaxed">
                {isMember
                  ? 'You can post inside this circle and follow the thread as it grows.'
                  : 'Join to contribute to the circle feed and take part in the community.'}
              </p>
            </div>

            <div className="rounded border-2 border-ink bg-[#FAF6EB] p-4 shadow-[3px_3px_0px_var(--ink)]">
              <div className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                Circle type
              </div>
              <p className="mt-2 text-sm font-serif text-zinc-700 leading-relaxed">
                Public, member-led and feed-focused. Posts published here appear in the circle feed and
                can be discovered from the directory.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4 border-b-4 border-ink pb-2">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-burgundy">
            Circle Press Feed
          </h2>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Published posts inside this circle
          </p>
        </div>

        {posts.length > 0 ? (
          <div className="grid gap-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={userId}
                onReactionUpdate={() => {}}
                onPostDelete={() => router.refresh()}
              />
            ))}
          </div>
        ) : (
          <div className="card-retro p-12 text-center bg-[#FAF6EB]">
            <div className="text-3xl mb-2">📰</div>
            <h3 className="font-display text-lg font-bold uppercase text-burgundy">
              No Drafts Logged
            </h3>
            <p className="text-xs font-serif text-zinc-600 max-w-xs mx-auto mt-1 leading-relaxed">
              No stories have been posted inside this circle yet. Be the first to forge a post inside.
            </p>
            <Link
              href={`/write?circle_id=${circle.id}`}
              className="btn-retro text-xs mt-4 uppercase font-bold"
            >
              Post Inside ✦
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
