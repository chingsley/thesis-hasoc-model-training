import { useMemo } from 'react'
import { getMockPosts } from '@/lib/api/mock'
import { useDashboardStore } from '@/lib/store/dashboard'

export function ToxicWordCloud() {
  const language = useDashboardStore((s) => s.language)

  const words = useMemo(() => {
    const posts = getMockPosts().filter((p) => p.language === language && (p.label === 'Hate' || p.label === 'Abuse'))
    const freq = new Map<string, number>()
    const toxicTerms = new Set([
      'ndi', 'onye', 'anya', 'agha', 'njo', 'ojoo', 'ara', 'nzuzu',
      'awon', 'buburu', 'ota', 'were', 'omugo', 'eniyan', 'nibi',
      'okwu', 'nke', 'mad', 'ka', 'asi', 'ko', 'talika', 'egbin',
      'ole', 'arekereke', 'iwe', 'irori', 'ogun', 'idajo',
    ])

    posts.forEach((p) => {
      p.tweet.split(/\s+/).forEach((token) => {
        const clean = token.toLowerCase().replace(/[^\w]/g, '')
        if (clean.length > 2 && toxicTerms.has(clean.toLowerCase())) {
          freq.set(clean, (freq.get(clean) ?? 0) + 1)
        }
      })
    })

    return Array.from(freq.entries())
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 40)
  }, [language])

  const maxVal = Math.max(...words.map((w) => w.value), 1)
  const fontSizeRange = { min: 12, max: 48 }

  if (words.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No toxic terms to display</p>
  }

  return (
    <div className="flex flex-wrap justify-center gap-1 p-4 min-h-[200px] items-center">
      {words.map(({ text, value }) => {
        const ratio = value / maxVal
        const fontSize = fontSizeRange.min + ratio * (fontSizeRange.max - fontSizeRange.min)
        const opacity = 0.4 + ratio * 0.6
        const hue = 0
        const sat = Math.round(70 + ratio * 30)
        const light = Math.round(80 - ratio * 40)

        return (
          <span
            key={text}
            style={{
              fontSize: `${fontSize}px`,
              opacity,
              color: `hsl(${hue}, ${sat}%, ${light}%)`,
              cursor: 'pointer',
            }}
            className="px-1 py-0.5 rounded hover:bg-accent transition-colors"
            title={`${text}: ${value} occurrences`}
          >
            {text}
          </span>
        )
      })}
    </div>
  )
}
