import Link from 'next/link'
import { getActivePlatformPrompt, getPromptArchive } from '@/lib/prompts'

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

export default function PromptsArchivePage() {
  const activePlatformPrompt = getActivePlatformPrompt()
  const platformPrompts = getPromptArchive('platform')
  const circlePrompts = getPromptArchive('circle')

  return (
    <div className="flex flex-col gap-8">
      <header className="card-retro p-8 bg-[#FAF6EB] border-ink flex flex-col gap-5">
        <div className="max-w-3xl">
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
            Prompt archive
          </p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight text-burgundy">
            Weekly prompts and response trails
          </h1>
          <p className="mt-3 font-serif text-zinc-700 leading-relaxed">
            Browse the current prompt, revisit older prompts, and open a response feed to read how
            the archive unfolds.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded border-2 border-ink bg-cream p-5 shadow-[3px_3px_0px_var(--ink)]">
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
              Current platform prompt
            </p>
            <h2 className="mt-2 font-display text-2xl font-black uppercase text-burgundy">
              {activePlatformPrompt.title}
            </h2>
            <p className="mt-2 text-sm font-serif text-zinc-700 leading-relaxed">
              {activePlatformPrompt.body}
            </p>
          </div>

          <div className="rounded border-2 border-ink bg-[#F8F1E3] p-5 shadow-[3px_3px_0px_var(--ink)]">
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
              How it works
            </p>
            <p className="mt-2 text-sm font-serif text-zinc-700 leading-relaxed">
              Platform prompts rotate weekly. Circle prompts rotate with the same cadence, but each
              circle picks its own lane.
            </p>
            <Link
              href={`/write?prompt=${activePlatformPrompt.id}`}
              className="btn-retro mt-4 inline-flex text-xs uppercase font-bold"
            >
              Respond now
            </Link>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b-4 border-ink pb-2">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-burgundy">
            Platform prompts
          </h2>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            {platformPrompts.length} prompts archived
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {platformPrompts.map((prompt) => (
            <article
              key={prompt.id}
              className="card-retro border-2 border-ink bg-[#FAF6EB] p-5 shadow-[4px_4px_0px_var(--ink)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="badge-retro bg-gold text-ink border-ink">
                  {prompt.active ? 'Active' : 'Archive'}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {formatDate(prompt.activationDate)}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-black uppercase text-burgundy">
                {prompt.title}
              </h3>
              <p className="mt-2 text-sm font-serif text-zinc-700 leading-relaxed">
                {prompt.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/prompts/${prompt.id}`}
                  className="btn-retro-secondary text-xs uppercase font-bold"
                >
                  View responses
                </Link>
                <Link
                  href={`/write?prompt=${prompt.id}`}
                  className="btn-retro text-xs uppercase font-bold"
                >
                  Respond
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b-4 border-ink pb-2">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-burgundy">
            Circle prompts
          </h2>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            {circlePrompts.length} prompts archived
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {circlePrompts.map((prompt) => (
            <article
              key={prompt.id}
              className="card-retro border-2 border-ink bg-[#F8F1E3] p-5 shadow-[4px_4px_0px_var(--ink)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="badge-retro bg-burgundy text-cream border-ink">
                  Circle
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {formatDate(prompt.activationDate)}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-black uppercase text-burgundy">
                {prompt.title}
              </h3>
              <p className="mt-2 text-sm font-serif text-zinc-700 leading-relaxed">
                {prompt.body}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/prompts/${prompt.id}`}
                  className="btn-retro-secondary text-xs uppercase font-bold"
                >
                  View responses
                </Link>
                <Link
                  href={`/write?prompt=${prompt.id}`}
                  className="btn-retro text-xs uppercase font-bold"
                >
                  Respond
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
