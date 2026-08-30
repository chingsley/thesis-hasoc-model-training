import { useQuery } from '@tanstack/react-query'
import { fetchToxicTerms, fetchWordCloud, type WordCloudTerm } from '@/lib/api/client'
import { getMockPosts } from '@/lib/api/mock'
import { USE_MOCK } from '@/lib/api/config'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

/** One hue per cloud; intensity tracks the same signal as size (no decorative colors). */
function colorForRatio(source: WordCloudSource, ratio: number): string {
  if (source === 'toxic') {
    // Alert red — darker = stronger toxicity contribution
    const light = Math.round(46 - ratio * 18)
    return `hsl(346, 100%, ${light}%)`
  }
  // Brand purple — darker = more frequent
  const light = Math.round(48 - ratio * 18)
  return `hsl(255, 22%, ${light}%)`
}

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
      (p) => p.language === language && (p.label === 'Hate' || p.label === 'Abuse'),
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

  if (!USE_MOCK && query.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[var(--hg-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {source === 'toxic' ? 'Measuring word toxicity…' : 'Loading…'}
        </span>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <p className="min-h-[240px] py-8 text-center text-[var(--hg-muted)]">
        {source === 'toxic' ? 'No toxic terms identified yet' : 'No toxic terms to display'}
      </p>
    )
  }

  return (
    <div
      className="flex min-h-[240px] flex-wrap content-center items-center justify-center gap-x-2.5 gap-y-1 rounded-[4px] bg-[var(--hg-canvas)] px-5 py-8 md:min-h-[280px] md:px-8 md:py-10"
      role="list"
      aria-label={source === 'toxic' ? 'Toxic terms word cloud' : 'Frequent terms word cloud'}
    >
      {words.map(({ text, value, count, contribution }) => {
        const ratio = Math.sqrt(Math.max(0, value) / maxVal)
        const fontSize = 13 + ratio * 30
        const weight = ratio > 0.72 ? 700 : ratio > 0.4 ? 600 : 500

        const title =
          source === 'toxic' && count !== undefined && contribution !== undefined
            ? `${text}: ${count}x in toxic posts, +${(contribution * 100).toFixed(1)}% toxicity per occurrence`
            : `${text}: ${value} occurrences`

        return (
          <span
            key={text}
            role="listitem"
            title={title}
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: weight,
              color: colorForRatio(source, ratio),
              lineHeight: 1.15,
            }}
            className={cn(
              'cursor-default select-none rounded-[3px] px-0.5 transition-colors',
              'hover:bg-white/80',
            )}
          >
            {text}
          </span>
        )
      })}
    </div>
  )
}
