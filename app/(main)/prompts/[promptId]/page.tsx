import Link from 'next/link'
import { createServerClient } from '@/lib/superbase-server'
import { getPromptById } from '@/lib/prompts'
import type { Post } from '@/components/feed/PostCard'
import PostCard from '@/components/feed/PostCard'

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

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

export default async function PromptDetailPage({
  params,
}: {
  params: { promptId: string }
}) {
  const prompt = getPromptById(params.promptId)

  if (!prompt) {
    return (
      <div className="card-retro p-10 text-center bg-[#FAF6EB]">
        <h1 className="font-display text-3xl font-black uppercase text-burgundy">
          Prompt not found
        </h1>
        <p className="mt-2 text-sm font-serif text-zinc-600">
          This prompt is not in the archive.
        </p>
        <Link href="/prompts" className="btn-retro mt-5 inline-flex text-xs uppercase font-bold">
          Back to prompts
        </Link>
      </div>
    )
  }

  const supabase = await createServerClient()
  const { data: rawPosts } = await supabase
    .from('posts')
    .select('*, profiles!posts_author_id_fkey(username, avatar_url)')
    .eq('is_published', true)
    .eq('prompt_id', prompt.id)
    .order('created_at', { ascending: false })

  const posts = sanitizePosts((rawPosts ?? []) as Post[])
  const isCirclePrompt = prompt.scope === 'circle'

  return (
    <div className="flex flex-col gap-8">
      <header className="card-retro p-8 bg-[#FAF6EB] border-ink flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge-retro ${isCirclePrompt ? 'bg-burgundy text-cream' : 'bg-gold text-ink'} border-ink`}>
                {isCirclePrompt ? 'Circle prompt' : 'Platform prompt'}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Activated {formatDate(prompt.activationDate)}
              </span>
            </div>
            <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight text-burgundy">
              {prompt.title}
            </h1>
            <p className="mt-3 text-sm font-serif text-zinc-700 leading-relaxed">
              {prompt.body}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/write?prompt=${prompt.id}`}
              className="btn-retro text-xs uppercase font-bold"
            >
              Respond now
            </Link>
            <Link href="/prompts" className="btn-retro-secondary text-xs uppercase font-bold">
              Back to archive
            </Link>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b-4 border-ink pb-2">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-burgundy">
            Prompt responses
          </h2>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            {posts.length} posts tagged with this prompt
          </p>
        </div>

        {posts.length > 0 ? (
          <div className="flex flex-col gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="card-retro p-12 text-center bg-[#FAF6EB] flex flex-col items-center justify-center gap-4">
            <div className="text-4xl">✍️</div>
            <h3 className="font-display text-xl font-bold uppercase text-burgundy">
              No responses yet
            </h3>
            <p className="text-sm font-serif text-zinc-600 max-w-sm">
              This prompt does not have any published responses yet. Be the first to answer it.
            </p>
            <Link href={`/write?prompt=${prompt.id}`} className="btn-retro text-xs mt-2 uppercase font-bold">
              Write a response
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
