'use client'

export type FeedTab = 'for_you' | 'latest' | 'trending'

interface FeedTabsProps {
  activeTab: FeedTab
  onChange: (tab: FeedTab) => void
}

export default function FeedTabs({ activeTab, onChange }: FeedTabsProps) {
  const tabs: { value: FeedTab; label: string; desc: string }[] = [
    {
      value: 'for_you',
      label: '✦ For You',
      desc: 'Based on coordinates',
    },
    {
      value: 'latest',
      label: '📇 Latest',
      desc: 'Fresh off the press',
    },
    {
      value: 'trending',
      label: '🔥 Trending',
      desc: 'Active overlaps',
    },
  ]

  return (
    <div className="border-b-4 border-ink flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={`px-6 py-3 font-display text-sm font-black uppercase tracking-wider border-2 border-ink rounded-t-md cursor-pointer transition-all border-b-0 -mb-[2px] ${
                isActive
                  ? 'bg-burgundy text-cream shadow-none translate-y-[2px]'
                  : 'bg-[#EAE3D2] text-ink hover:bg-[#FAF6EB]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
