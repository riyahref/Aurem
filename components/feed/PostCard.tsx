'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import { getPromptById } from '@/lib/prompts'
import ReactionBar from './ReactionBar'

export interface Post {
  id: string
  title: string
  content: string
  post_type: string
  tags: string[]
  is_anonymous: boolean
  content_warning: boolean
  featured_image_url: string | null
  prompt_id?: string | null
  created_at: string
  author_id: string | null
  profiles: {
    username: string
    avatar_url: string | null
  } | null
}

interface PostCardProps {
  post: Post
  currentUserId?: string | null
  onReactionUpdate?: () => void
  onPostDelete?: () => void
}

export default function PostCard({
  post,
  currentUserId,
  onReactionUpdate,
  onPostDelete,
}: PostCardProps) {
  const [revealed, setRevealed] = useState(!post.content_warning)
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const hasFeaturedImage = Boolean(post.featured_image_url)
  const prompt = post.prompt_id ? getPromptById(post.prompt_id) : null
  const canDeletePost = Boolean(currentUserId && post.author_id === currentUserId && !post.is_anonymous)
  const normalizedPostType =
    post.post_type.trim().toLowerCase() === 'rant'
      ? 'Rant'
      : post.post_type.trim().toLowerCase() === 'confess'
        ? 'Confess'
        : 'Story'

  const formattedDate = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  useEffect(() => {
    if (!isActionsOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setIsActionsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isActionsOpen])

  const getBadgeStyle = () => {
    switch (normalizedPostType) {
      case 'Rant':
        return 'bg-burgundy text-cream border-ink'
      case 'Confess':
        return 'bg-ink text-cream border-cream'
      case 'Story':
        return 'bg-gold text-ink border-ink'
      default:
        return 'bg-rose text-ink border-ink'
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This will remove it from the feed.')) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete post.')
        return
      }

      onPostDelete?.()
    } catch (error) {
      console.error(error)
      alert('Failed to delete post.')
    }
  }

  return (
    <article className="card-retro p-6 flex flex-col gap-4 relative bg-[#FAF6EB]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink/10 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-7 w-7 rounded-full border-2 border-ink bg-rose flex items-center justify-center font-display font-black text-xs uppercase select-none">
            {post.is_anonymous || !post.profiles?.username ? '?' : post.profiles.username[0]}
          </div>
          <div className="min-w-0">
            {post.is_anonymous || !post.profiles?.username ? (
              <span className="font-display font-bold text-sm italic text-zinc-600">
                Anonymous Confession
              </span>
            ) : (
              <Link
                href={`/profile/${post.profiles.username}`}
                className="font-display font-bold text-sm text-burgundy hover:underline hover:text-ink transition-colors"
              >
                @{post.profiles.username}
              </Link>
            )}
            <span className="text-zinc-400 text-xs mx-2 select-none">✦</span>
            <time className="text-xs text-zinc-500 font-mono" dateTime={post.created_at}>
              {formattedDate}
            </time>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`badge-retro ${getBadgeStyle()}`}>{normalizedPostType}</span>
          {prompt && (
            <Link
              href={`/prompts/${prompt.id}`}
              className="rounded-full border border-burgundy/20 bg-burgundy/5 px-3 py-1 text-[10px] font-mono font-black uppercase tracking-wider text-burgundy transition-colors hover:bg-burgundy/10"
            >
              Prompt: {prompt.title}
            </Link>
          )}
          {canDeletePost && (
            <div ref={actionsRef} className="relative">
              <button
                type="button"
                onClick={() => setIsActionsOpen((open) => !open)}
                className="inline-flex items-center justify-center rounded border-2 border-ink bg-cream px-2.5 py-1.5 text-ink transition-colors hover:bg-gold/20"
                aria-haspopup="menu"
                aria-expanded={isActionsOpen}
                aria-label="Post actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {isActionsOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded border-2 border-ink bg-cream shadow-[3px_3px_0px_var(--ink)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsActionsOpen(false)
                      void handleDelete()
                    }}
                    className="w-full px-4 py-3 text-left text-xs font-mono font-black uppercase tracking-wider text-burgundy transition-colors hover:bg-rose/10"
                  >
                    Delete post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {hasFeaturedImage && (
        <div className="overflow-hidden rounded border-2 border-ink bg-[#F4E7D8] shadow-[3px_3px_0px_var(--ink)]">
          <img
            src={post.featured_image_url as string}
            alt={post.title || 'Featured story cover'}
            className="h-48 w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {post.title && post.title !== 'Untitled' && (
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">
          {post.title}
        </h3>
      )}

      <div className="relative">
        {post.content_warning && !revealed ? (
          <div className="p-6 border-2 border-dashed border-burgundy rounded bg-rose/5 text-center flex flex-col items-center justify-center gap-3">
            <div className="text-burgundy font-display text-sm font-black uppercase tracking-wider">
              Content Warning Attached
            </div>
            <p className="text-xs text-zinc-600 max-w-md">
              This confession contains sensitive topics. Click below to un-ink the document.
            </p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="btn-retro py-1.5 px-4 text-xs tracking-wide"
            >
              Reveal Confession ✦
            </button>
          </div>
        ) : (
          <div
            className="font-mono text-sm leading-relaxed prose prose-zinc prose-sm select-text"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        )}
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 border border-ink text-[10px] font-mono font-bold uppercase rounded bg-cream/50 text-zinc-700"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="border-t-2 border-ink/10 pt-4 mt-auto">
        <ReactionBar
          postId={post.id}
          currentUserId={currentUserId}
          onReactionUpdate={onReactionUpdate}
        />
      </div>
    </article>
  )
}
