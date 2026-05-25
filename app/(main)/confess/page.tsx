'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import PostCard, { Post } from '@/components/feed/PostCard'
import WriteEditor from '@/components/editor/WriteEditor'

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function ConfessWall() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const composerRef = useRef<HTMLDivElement | null>(null)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
      }
    }

    loadUser()
  }, [supabase])

  const fetchConfessions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/posts?is_anonymous=true')
      const data = await response.json()

      if (response.ok) {
        setPosts(data)
      } else {
        console.error(data.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function loadConfessions() {
      await fetchConfessions()
    }

    void loadConfessions()
  }, [])

  const openComposer = () => {
    setComposerOpen(true)
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!userId) {
      setError('Please log in before submitting a confession.')
      return
    }

    if (!warningAcknowledged) {
      setError('Please acknowledge the content warning before publishing.')
      return
    }

    if (!stripHtml(content)) {
      setError('Please add some confession text before publishing.')
      return
    }

    setSubmitting(true)
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
          post_type: 'Confess',
          tags: [],
          circle_id: null,
          content_warning: true,
          featured_image_url: '',
          prompt_id: null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to publish confession.')
        return
      }

      setTitle('')
      setContent('')
      setWarningAcknowledged(false)
      closeComposer()
      await fetchConfessions()
    } catch (publishError) {
      console.error(publishError)
      setError('Failed to publish confession.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="card-retro p-6 bg-ink text-cream border-cream relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'radial-gradient(var(--cream) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-black uppercase tracking-tight text-rose">
              The Anonymous Wall
            </h1>
            <p className="font-serif italic text-zinc-300 text-xs mt-1 max-w-md leading-relaxed">
              Whisper your secrets. All identities are stripped on the server before they are
              shown here.
            </p>
          </div>
          <button
            type="button"
            onClick={openComposer}
            className="px-4 py-2 bg-rose text-ink border-2 border-cream rounded font-display font-black text-xs uppercase tracking-wider hover:bg-[#c9939e] transition-colors shadow-[3px_3px_0px_var(--cream)]"
          >
            Open submission form
          </button>
        </div>
      </header>

      {composerOpen && (
        <section
          ref={composerRef}
          id="confess-submission"
          className="card-retro p-6 bg-[#FAF6EB] border-2 border-ink shadow-[4px_4px_0px_var(--ink)]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                Submission form
              </p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase leading-tight text-burgundy">
                Drop an anonymous confession
              </h2>
              <p className="mt-2 text-sm font-serif leading-relaxed text-zinc-700">
                Every confession is published anonymously and must be content-warned before
                posting.
              </p>
            </div>
            <button
              type="button"
              onClick={closeComposer}
              className="btn-retro-secondary text-xs uppercase font-bold self-start"
            >
              Close
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded border-2 border-burgundy bg-rose/20 px-4 py-3 text-sm font-bold text-burgundy">
              {error}
            </div>
          )}

          {!userId ? (
            <div className="mt-6 rounded border-2 border-dashed border-ink bg-cream px-4 py-4 text-sm text-zinc-700">
              <p className="font-bold text-burgundy">Log in to submit a confession.</p>
              <p className="mt-1 text-sm font-serif">
                Anonymous posts still require an authenticated account so the server can strip
                your identity before publishing.
              </p>
              <Link href="/login" className="btn-retro mt-4 inline-flex text-xs uppercase font-bold">
                Log in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="flex flex-col">
                <label htmlFor="confess-title" className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
                  Optional Title
                </label>
                <input
                  id="confess-title"
                  type="text"
                  className="input-retro"
                  placeholder="A short headline for the wall"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
                  Confession
                </label>
                <WriteEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write what you need to say..."
                />
              </div>

              <div className="rounded border-2 border-burgundy bg-rose/10 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-display text-sm font-bold uppercase text-burgundy">
                      Content Warning Acknowledgement
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      All confessions are shown with a content warning. Please confirm you
                      understand before publishing.
                    </p>
                  </div>
                  <span className="rounded-full border border-burgundy bg-cream px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-burgundy">
                    Required
                  </span>
                </div>

                <label className="flex items-start gap-3 text-sm text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={warningAcknowledged}
                    onChange={(event) => setWarningAcknowledged(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-burgundy"
                  />
                  <span>
                    I understand this confession will be published anonymously and marked with a
                    content warning.
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !warningAcknowledged}
                  className="btn-retro px-5 uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Publishing...' : 'Publish confession'}
                </button>
                <button
                  type="button"
                  onClick={closeComposer}
                  className="rounded border-2 border-ink bg-cream px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 hover:shadow-[1px_1px_0px_var(--ink)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {loading ? (
        <div className="py-12 text-center font-mono text-zinc-400 animate-pulse">
          Opening confessional logs...
        </div>
      ) : posts.length > 0 ? (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={userId} onReactionUpdate={fetchConfessions} />
          ))}
        </div>
      ) : (
        <div className="card-retro p-12 text-center bg-[#FAF6EB] flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">?</div>
          <h3 className="font-display text-xl font-bold uppercase text-burgundy">
            Absolute Silence
          </h3>
          <p className="text-sm font-serif text-zinc-600 max-w-sm">
            No secrets have been dropped on the wall yet. Open the submission form to publish your
            first anonymous confession.
          </p>
          <button
            type="button"
            onClick={openComposer}
            className="btn-retro text-xs mt-2 uppercase font-bold"
          >
            Open submission form
          </button>
        </div>
      )}
    </div>
  )
}
