'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface ReactionBarProps {
  postId: string
  currentUserId?: string | null
  onReactionUpdate?: () => void
}

const REACTION_TYPES = [
  { type: 'feel_this', emoji: '💌', label: 'I feel this' },
  { type: 'say_it_louder', emoji: '🔥', label: 'Say it louder' },
  { type: 'sending_love', emoji: '👻', label: 'Sending love' },
  { type: 'same', emoji: '🤤', label: 'Same' },
  { type: 'this_is_art', emoji: '✨', label: 'This is art' },
]

interface ReactionData {
  [type: string]: {
    count: number
    hasReacted: boolean
  }
}

export default function ReactionBar({ postId, currentUserId, onReactionUpdate }: ReactionBarProps) {
  const [reactions, setReactions] = useState<ReactionData>({
    feel_this: { count: 0, hasReacted: false },
    say_it_louder: { count: 0, hasReacted: false },
    sending_love: { count: 0, hasReacted: false },
    same: { count: 0, hasReacted: false },
    this_is_art: { count: 0, hasReacted: false },
  })
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserSupabaseClient()

  // Fetch reactions from backend
  useEffect(() => {
    async function fetchReactions() {
      try {
        const { data, error } = await supabase
          .from('reactions')
          .select('reaction_type, user_id')
          .eq('post_id', postId)

        if (error) {
          console.error(error)
          return
        }

        const counts: ReactionData = {
          feel_this: { count: 0, hasReacted: false },
          say_it_louder: { count: 0, hasReacted: false },
          sending_love: { count: 0, hasReacted: false },
          same: { count: 0, hasReacted: false },
          this_is_art: { count: 0, hasReacted: false },
        }

        if (data) {
          data.forEach((r) => {
            const type = r.reaction_type
            if (counts[type]) {
              counts[type].count += 1
              if (currentUserId && r.user_id === currentUserId) {
                counts[type].hasReacted = true
              }
            }
          })
        }

        setReactions(counts)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchReactions()
  }, [postId, currentUserId, supabase])

  const handleReact = async (type: string) => {
    if (!currentUserId) {
      alert('Please log in to react to posts!')
      return
    }

    const originalState = { ...reactions[type] }
    const isAdding = !originalState.hasReacted

    setReactions((prev) => ({
      ...prev,
      [type]: {
        count: isAdding ? originalState.count + 1 : Math.max(0, originalState.count - 1),
        hasReacted: isAdding,
      },
    }))

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('reactions')
          .insert({
            post_id: postId,
            user_id: currentUserId,
            reaction_type: type,
          })

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId)
          .eq('reaction_type', type)

        if (error) throw error
      }

      onReactionUpdate?.()
    } catch (err) {
      console.error('Failed to update reaction, rolling back...', err)
      setReactions((prev) => ({
        ...prev,
        [type]: originalState,
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 text-xs font-mono text-zinc-400 select-none">
        Loading stamps...
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {REACTION_TYPES.map(({ type, emoji, label }) => {
        const { count, hasReacted } = reactions[type]
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleReact(type)}
            title={label}
            aria-pressed={hasReacted}
            className={`px-3 py-1.5 border-2 rounded text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all select-none cursor-pointer ${
              hasReacted
                ? 'bg-burgundy text-cream border-ink scale-[1.04] shadow-[1px_1px_0px_var(--ink)]'
                : 'bg-[#FAF6EB] text-ink border-ink hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_var(--ink)]'
            }`}
          >
            <span className="text-sm select-none">{emoji}</span>
            <span className="font-bold select-none">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
