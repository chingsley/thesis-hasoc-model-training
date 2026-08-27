import { useQuery } from '@tanstack/react-query'
import { fetchToxicTerms, fetchWordCloud, type WordCloudTerm } from '@/lib/api/client'
import { getMockPosts } from '@/lib/api/mock'
import { USE_MOCK } from '@/lib/api/config'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'

export type WordCloudSource = 'frequent' | 'toxic'

// Demo-mode only: the live backend computes both views from the prediction log.
const MOCK_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'you', 'your', 'are', 'was', 'from', 'they',
  'them', 'have', 'will', 'not', 'but', 'all', 'can', 'our', 'who', 'their', 'what',
])

const MOCK_TOXIC_TERMS = new Set([
  'ndi', 'onye', 'anya', 'agha', 'njo', 'ojoo', 'ara', 'nzuzu',
  'awon', 'buburu', 'ota', 'were', 'omugo', 'eniyan', 'nibi',
  'okwu', 'nke', 'mad', 'ka', 'asi', 'ko', 'talika', 'egbin',
  'ole', 'arekereke', 'iwe', 'irori', 'ogun', 'idajo',
])

interface ToxicWordCloudProps {
  /** 'frequent' = most common words in Hate/Abuse posts (surfaces targets);
   *  'toxic' = words that measurably raise the model's toxicity score. */
  source?: WordCloudSource
}

export function ToxicWordCloud({ source = 'frequent' }: ToxicWordCloudProps) {
  const language = useDashboardStore((s) => s.language)

  const query = useQuery({
    queryKey: ['wordcloud', language, source],
    queryFn: () => (source === 'toxic' ? fetchToxicTerms(language) : fetchWordCloud(language)),
    enabled: !USE_MOCK,
    staleTime: 60000,
  })

  const words: WordCloudTerm[] = useMemo(() => {
    if (!USE_MOCK) {
      return query.data ?? []
    }
    const posts = getMockPosts().filter(
      (p) => p.language === language && (p.label === 'Hate' || p.label === 'Abuse')
    )
    const freq = new Map<string, number>()
    posts.forEach((p) => {
      p.tweet.split(/\s+/).forEach((token) => {
        const clean = token.toLowerCase().replace(/[^\w]/g, '')
        if (clean.length <= 2) return
        const excluded =
          source === 'toxic' ? !MOCK_TOXIC_TERMS.has(clean) : MOCK_STOPWORDS.has(clean)
        if (excluded) return
        freq.set(clean, (freq.get(clean) ?? 0) + 1)
      })
    })
    return Array.from(freq.entries())
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 40)
  }, [language, query.data, source])

  const maxVal = Math.max(...words.map((w) => w.value), source === 'toxic' ? 0.0001 : 1)
  const fontSizeRange = { min: 12, max: 48 }

  if (!USE_MOCK && query.isPending) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {source === 'toxic' ? 'Measuring word toxicity…' : 'Loading…'}
        </span>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        {source === 'toxic' ? 'No toxic terms identified yet' : 'No toxic terms to display'}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap justify-center gap-1 p-4 min-h-[200px] items-center">
      {words.map(({ text, value, count, contribution }) => {
        const ratio = value / maxVal
        const fontSize = fontSizeRange.min + ratio * (fontSizeRange.max - fontSizeRange.min)
        const opacity = 0.4 + ratio * 0.6
        const hue = 0
        const sat = Math.round(70 + ratio * 30)
        const light = Math.round(80 - ratio * 40)

        const title =
          source === 'toxic' && count !== undefined && contribution !== undefined
            ? `${text}: ${count}x in toxic posts, +${(contribution * 100).toFixed(1)}% toxicity per occurrence`
            : `${text}: ${value} occurrences`

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
            title={title}
          >
            {text}
          </span>
        )
      })}
    </div>
  )
}
