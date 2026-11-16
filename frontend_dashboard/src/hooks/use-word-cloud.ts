import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchToxicTerms, fetchWordCloud, type WordCloudTerm } from '@/lib/api/client'
import { getMockPosts } from '@/lib/api/mock'
import { USE_MOCK } from '@/lib/api/config'
import { useDashboardStore } from '@/lib/store/dashboard'

/** 'frequent' = most common words in Hate/Abuse posts (surfaces targets);
 *  'toxic' = words that measurably raise the model's toxicity score. */
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

/** Terms for one word view, largest first, shared by the word cloud and the plain word list. */
export function useWordCloudTerms(source: WordCloudSource): {
  words: WordCloudTerm[]
  isPending: boolean
} {
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

  return { words, isPending: !USE_MOCK && query.isPending }
}
