import { createServerClient } from '@/lib/superbase-server'
import { getActivePlatformPrompt } from '@/lib/prompts'
import type { Post } from '@/components/feed/PostCard'
import HomeFeedClient from '@/components/feed/HomeFeedClient'
import type { FeedProfile } from '@/components/feed/HomeFeedClient'

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

export default async function HomeFeedPage() {
  const supabase = await createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const currentUserId = session?.user?.id ?? null

  let profile: FeedProfile | null = null

  if (currentUserId) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, tags')
      .eq('id', currentUserId)
      .maybeSingle()

    profile = profileData ?? null
  }

  const { data: rawPosts } = await supabase
    .from('posts')
    .select('*, profiles!posts_author_id_fkey(username, avatar_url)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(10)

  const initialPosts = sanitizePosts((rawPosts ?? []) as Post[])
  const activePrompt = getActivePlatformPrompt()

  return (
    <HomeFeedClient
      initialPosts={initialPosts}
      initialProfile={profile}
      initialUserId={currentUserId}
      activePrompt={activePrompt}
    />
  )
}
