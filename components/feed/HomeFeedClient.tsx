'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { PromptRecord } from '@/lib/prompts'
import FeedTabs, { FeedTab } from './FeedTabs'
import PostCard, { Post } from './PostCard'

export interface FeedProfile {
  id: string
  username: string | null
  display_name?: string | null
  bio?: string | null
  tags?: string[] | null
}

interface HomeFeedClientProps {
  initialPosts: Post[]
  initialProfile: FeedProfile | null
  initialUserId: string | null
  activePrompt: PromptRecord
}

function sanitizePosts(posts: Post[]): Post[] {
  return posts.map((post) => {
    if (!post.is_anonymous) {
      return post
    }

    return {
      ...post,
      author_id: null,
      profiles: {
        username: 'Anonymous',
        avatar_url: null,
      },
    }
  })
}

function getReactionCountMap(posts: { post_id: string }[] | null | undefined) {
  const reactionCountsMap: Record<string, number> = {}

  if (!posts) {
    return reactionCountsMap
  }

  posts.forEach((reaction) => {
    reactionCountsMap[reaction.post_id] = (reactionCountsMap[reaction.post_id] || 0) + 1
  })

  return reactionCountsMap
}

function getPostAgeHours(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60))
}

function computeTrendingScore(reactionCount: number, ageHours: number) {
  const recencyBoost = 1 / (1 + ageHours / 24)
  return reactionCount * 0.7 + recencyBoost * 3
}

function scoreForYouPost(
  post: Post,
  tags: string[],
  followedAuthorIds: Set<string>,
  reactionCountsMap: Record<string, number>,
  maxReactionCount: number
) {
  const tagMatches = tags.length
    ? post.tags.filter((tag) => tags.includes(tag)).length / tags.length
    : 0
  const authorBoost = post.author_id && followedAuthorIds.has(post.author_id) ? 1 : 0
  const reactionCount = reactionCountsMap[post.id] || 0
  const trendingBase = maxReactionCount > 0 ? reactionCount / maxReactionCount : 0
  const recencyBoost = 1 / (1 + getPostAgeHours(post.created_at) / 36)

  return tagMatches * 0.6 + authorBoost * 0.3 + trendingBase * 0.07 + recencyBoost * 0.03
}

function sortTrendingPosts(posts: Post[], reactionCountsMap: Record<string, number>) {
  return [...posts].sort((a, b) => {
    const scoreA = computeTrendingScore(reactionCountsMap[a.id] || 0, getPostAgeHours(a.created_at))
    const scoreB = computeTrendingScore(reactionCountsMap[b.id] || 0, getPostAgeHours(b.created_at))
    return scoreB - scoreA
  })
}

export default function HomeFeedClient({
  initialPosts,
  initialProfile,
  initialUserId,
  activePrompt,
}: HomeFeedClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [activeTab, setActiveTab] = useState<FeedTab>('latest')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<FeedProfile | null>(initialProfile)
  const [userId, setUserId] = useState<string | null>(initialUserId)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const didHydrateRef = useRef(false)

  const supabase = createBrowserSupabaseClient()
  const isRefreshing = loading && posts.length > 0

  useEffect(() => {
    async function loadUser() {
      if (userId && profile) {
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        return
      }

      setUserId(session.user.id)

      const [{ data: prof }, { data: followRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, bio, tags')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', session.user.id),
      ])

      if (prof) {
        setProfile(prof)
      }

      setFollowingIds(new Set((followRows ?? []).map((row) => row.following_id)))
    }

    loadUser()
  }, [profile, supabase, userId])

  const fetchPosts = async () => {
    setLoading(true)

    try {
      const [{ data: rawPosts, error: postsError }, { data: allReactions, error: rxError }] =
        await Promise.all([
          supabase
            .from('posts')
            .select('*, profiles!posts_author_id_fkey(username, avatar_url)')
            .eq('is_published', true)
            .order('created_at', { ascending: false }),
          supabase.from('reactions').select('post_id'),
        ])

      if (postsError) {
        console.error(postsError)
        return
      }

      const reactionCountsMap = getReactionCountMap(rxError ? [] : allReactions)
      const maxReactionCount = Math.max(1, ...Object.values(reactionCountsMap))

      let parsedPosts: Post[] = sanitizePosts((rawPosts ?? []) as Post[])

      if (activeTab === 'for_you') {
        const tags = profile?.tags ?? []

        if (tags.length < 3) {
          setPosts([])
          return
        }

        parsedPosts = parsedPosts
          .filter((post) => {
            const hasTagOverlap = post.tags.some((tag) => tags.includes(tag))
            const followedAuthor = post.author_id ? followingIds.has(post.author_id) : false
            return hasTagOverlap || followedAuthor
          })
          .sort(
            (a, b) =>
              scoreForYouPost(b, tags, followingIds, reactionCountsMap, maxReactionCount) -
              scoreForYouPost(a, tags, followingIds, reactionCountsMap, maxReactionCount)
          )
      } else if (activeTab === 'trending') {
        parsedPosts = sortTrendingPosts(parsedPosts, reactionCountsMap)
      }

      setPosts(parsedPosts)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!didHydrateRef.current) {
      didHydrateRef.current = true
      return
    }

    fetchPosts()
  }, [activeTab, followingIds, profile])

  return (
    <div className="flex flex-col gap-6">
      <section className="card-retro border-2 border-ink bg-[#FAF6EB] p-5 shadow-[4px_4px_0px_var(--ink)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
              This week&apos;s prompt
            </p>
            <h2 className="mt-2 font-display text-2xl font-black uppercase leading-tight text-burgundy">
              {activePrompt.title}
            </h2>
            <p className="mt-2 text-sm font-serif leading-relaxed text-zinc-700">
              {activePrompt.body}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/write?prompt=${activePrompt.id}`}
              className="btn-retro text-xs uppercase font-bold"
            >
              Respond now
            </Link>
            <Link
              href={`/prompts/${activePrompt.id}`}
              className="btn-retro-secondary text-xs uppercase font-bold"
            >
              View archive
            </Link>
          </div>
        </div>
      </section>

      <FeedTabs activeTab={activeTab} onChange={setActiveTab} />

      {loading && posts.length === 0 ? (
        <div className="py-12 text-center font-mono text-zinc-400 animate-pulse">
          Retrieving logs from database...
        </div>
      ) : posts.length > 0 ? (
        <div className="flex flex-col gap-6">
          {isRefreshing && (
            <div className="rounded border-2 border-dashed border-ink bg-gold/10 px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider text-ink">
              Refreshing your feed...
            </div>
          )}
          {activeTab === 'for_you' && (
            <div className="p-4 bg-gold/10 border-2 border-dashed border-ink rounded font-mono text-xs font-bold text-ink uppercase">
              ✦ Printing matches based on your coordinates: {profile?.tags?.join(', ')}
            </div>
          )}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              onReactionUpdate={fetchPosts}
              onPostDelete={fetchPosts}
            />
          ))}
        </div>
      ) : (
        <div className="card-retro p-12 text-center bg-[#FAF6EB] flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">📭</div>
          {activeTab === 'for_you' && !userId ? (
            <>
              <h3 className="font-display text-xl font-bold uppercase text-burgundy">
                Marginalized coordinates
              </h3>
              <p className="text-sm font-serif text-zinc-600 max-w-sm">
                Please log in and complete your onboarding coordinates to see tailored posts.
              </p>
              <Link href="/login" className="btn-retro text-xs mt-2 uppercase font-bold">
                Log In ✦
              </Link>
            </>
          ) : activeTab === 'for_you' && (profile?.tags?.length ?? 0) < 3 ? (
            <>
              <h3 className="font-display text-xl font-bold uppercase text-burgundy">
                Add more coordinates
              </h3>
              <p className="text-sm font-serif text-zinc-600 max-w-sm">
                For You works best after you choose at least 3 interest tags. Open onboarding to
                update your profile coordinates and unlock personalized overlaps.
              </p>
              <Link href="/onboarding" className="btn-retro text-xs mt-2 uppercase font-bold">
                Open onboarding ✦
              </Link>
            </>
          ) : activeTab === 'for_you' ? (
            <>
              <h3 className="font-display text-xl font-bold uppercase text-burgundy">
                Zero matching overlaps
              </h3>
              <p className="text-sm font-serif text-zinc-600 max-w-sm">
                None of the published stories overlap with your coordinates ({profile?.tags?.join(', ')}). Try writing a story with these tags or explore the Latest feed!
              </p>
              <button
                onClick={() => setActiveTab('latest')}
                className="btn-retro-secondary text-xs mt-2"
              >
                Go to Latest Feed
              </button>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl font-bold uppercase text-burgundy">
                No logs printed
              </h3>
              <p className="text-sm font-serif text-zinc-600 max-w-sm">
                The printing press has not received any drafts. Be the first to forge a post!
              </p>
              <Link href="/write" className="btn-retro text-xs mt-2 uppercase font-bold">
                Forge a Post ✦
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
