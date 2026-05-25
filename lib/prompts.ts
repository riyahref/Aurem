export type PromptScope = 'platform' | 'circle'

export interface PromptItem {
  id: string
  title: string
  body: string
  scope: PromptScope
  activationDate: string
}

export interface PromptRecord extends PromptItem {
  isActive: boolean
}

export interface PromptArchiveItem extends PromptItem {
  active: boolean
}

const PLATFORM_PROMPTS: Omit<PromptItem, 'activationDate'>[] = [
  {
    id: 'choose-yourself',
    title: 'Choose Yourself',
    body: 'Write about the last time you chose yourself, even if it made things messy.',
    scope: 'platform',
  },
  {
    id: 'pretended-fine',
    title: 'Pretended Fine',
    body: 'Describe a moment when you pretended to be fine and what it cost you.',
    scope: 'platform',
  },
  {
    id: 'unspoken-letter',
    title: 'Unspoken Letter',
    body: 'Write a letter you never sent. You can address it to a person, a season, or your past self.',
    scope: 'platform',
  },
  {
    id: 'small-rebellion',
    title: 'Small Rebellion',
    body: 'Tell the story of a small rebellion that changed how you see your life.',
    scope: 'platform',
  },
  {
    id: 'safe-place',
    title: 'Safe Place',
    body: 'Describe a place, ritual, or person that helps you feel safe enough to be honest.',
    scope: 'platform',
  },
  {
    id: 'still-healing',
    title: 'Still Healing',
    body: 'Write about something you are still healing from, without rushing the ending.',
    scope: 'platform',
  },
]

const CIRCLE_PROMPTS: Omit<PromptItem, 'activationDate'>[] = [
  {
    id: 'circle-hands',
    title: 'Hands That Stayed',
    body: 'Write about the person or community that stayed when things got hard.',
    scope: 'circle',
  },
  {
    id: 'circle-loud',
    title: 'Speak It Loud',
    body: 'What truth do you wish your circle could hear from you right now?',
    scope: 'circle',
  },
  {
    id: 'circle-edges',
    title: 'At the Edges',
    body: 'Describe the feeling of being on the edge of belonging, then stepping in.',
    scope: 'circle',
  },
  {
    id: 'circle-table',
    title: 'The Shared Table',
    body: 'Write about a shared space that made you feel less alone.',
    scope: 'circle',
  },
]

const PLATFORM_BASE_MONDAY = new Date('2026-01-05T00:00:00+05:30')
const CIRCLE_BASE_MONDAY = new Date('2026-01-05T00:00:00+05:30')

function startOfWeekInIst(date: Date) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(utc + istOffsetMs)
  const day = istDate.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  istDate.setUTCDate(istDate.getUTCDate() + diff)
  istDate.setUTCHours(0, 0, 0, 0)
  return new Date(istDate.getTime() - istOffsetMs)
}

function getWeeksBetween(start: Date, end: Date) {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  return Math.floor((startOfWeekInIst(end).getTime() - startOfWeekInIst(start).getTime()) / weekMs)
}

function withActivationDates(
  prompts: Omit<PromptItem, 'activationDate'>[],
  baseMonday: Date,
  currentDate: Date = new Date()
): PromptRecord[] {
  const currentWeek = getWeeksBetween(baseMonday, currentDate)

  return prompts.map((prompt, index) => {
    const activation = new Date(baseMonday.getTime())
    activation.setUTCDate(activation.getUTCDate() + index * 7)

    return {
      ...prompt,
      activationDate: activation.toISOString(),
      isActive: index === ((currentWeek % prompts.length) + prompts.length) % prompts.length,
    }
  })
}

export function getActivePlatformPrompt(now: Date = new Date()) {
  const prompts = withActivationDates(PLATFORM_PROMPTS, PLATFORM_BASE_MONDAY, now)
  const active = prompts.find((prompt) => prompt.isActive)
  return active ?? prompts[0]
}

export function getActiveCirclePrompt(circleSlug: string, now: Date = new Date()) {
  const prompts = withActivationDates(CIRCLE_PROMPTS, CIRCLE_BASE_MONDAY, now)
  const seed = [...circleSlug].reduce((value, char) => (value * 31 + char.charCodeAt(0)) % prompts.length, 0)
  return prompts[(seed + getWeeksBetween(CIRCLE_BASE_MONDAY, now)) % prompts.length]
}

export function getPromptById(promptId: string, now: Date = new Date()) {
  const allPrompts = [
    ...withActivationDates(PLATFORM_PROMPTS, PLATFORM_BASE_MONDAY, now),
    ...withActivationDates(CIRCLE_PROMPTS, CIRCLE_BASE_MONDAY, now),
  ]

  return allPrompts.find((prompt) => prompt.id === promptId) ?? null
}

export function getPromptArchive(scope: PromptScope, now: Date = new Date()): PromptArchiveItem[] {
  const source = scope === 'platform' ? PLATFORM_PROMPTS : CIRCLE_PROMPTS
  const base = scope === 'platform' ? PLATFORM_BASE_MONDAY : CIRCLE_BASE_MONDAY
  const prompts = withActivationDates(source, base, now)

  return prompts.map((prompt) => ({
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    scope: prompt.scope,
    activationDate: prompt.activationDate,
    active: prompt.isActive,
  }))
}
