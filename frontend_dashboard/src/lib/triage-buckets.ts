import type { Post, TriageBucket, TriageBucketCounts, TriageStatsData } from '@/lib/types'

export const TRIAGE_PAGE_SIZE = 25

/** Page size for the All (pending) bucket — shows full queue up to API max. */
export const TRIAGE_ALL_BUCKET_PAGE_SIZE = 500

export function bucketPosts(posts: Post[]): Record<TriageBucket, Post[]> {
  return {
    pending: posts,
    flagged: posts.filter((p) => p.triage_status === 'flagged'),
    relabelled: posts.filter((p) => p.manual_label && p.manual_label !== p.predicted_label),
  }
}

function labelBreakdown(posts: Post[], predicted: 'Normal' | 'Hate' | 'Abuse') {
  const subset = posts.filter((p) => p.predicted_label === predicted)
  const flagged = subset.filter((p) => p.triage_status === 'flagged').length
  const relabelled = subset.filter(
    (p) =>
      Boolean(p.manual_label && p.manual_label !== p.predicted_label) &&
      p.triage_status !== 'flagged',
  ).length
  const other = subset.length - flagged - relabelled
  return { flagged, relabelled, other }
}

function countsFor(posts: Post[]): TriageBucketCounts {
  const normalBd = labelBreakdown(posts, 'Normal')
  const hateBd = labelBreakdown(posts, 'Hate')
  const abuseBd = labelBreakdown(posts, 'Abuse')
  return {
    total: posts.length,
    normal: posts.filter((p) => p.predicted_label === 'Normal').length,
    hate: posts.filter((p) => p.predicted_label === 'Hate').length,
    abuse: posts.filter((p) => p.predicted_label === 'Abuse').length,
    normal_flagged: normalBd.flagged,
    normal_relabelled: normalBd.relabelled,
    normal_other: normalBd.other,
    hate_flagged: hateBd.flagged,
    hate_relabelled: hateBd.relabelled,
    hate_other: hateBd.other,
    abuse_flagged: abuseBd.flagged,
    abuse_relabelled: abuseBd.relabelled,
    abuse_other: abuseBd.other,
  }
}

export function triageStatsFromPosts(posts: Post[]): TriageStatsData {
  const buckets = bucketPosts(posts)
  return {
    pending: countsFor(buckets.pending),
    flagged: countsFor(buckets.flagged),
    relabelled: countsFor(buckets.relabelled),
  }
}

export function filterTriagePosts(
  posts: Post[],
  opts: {
    label?: 'Normal' | 'Hate' | 'Abuse' | 'all'
    q?: string
    since?: string
    until?: string
    hateMin?: number | null
    hateMax?: number | null
  },
): Post[] {
  const label = opts.label ?? 'all'
  const q = opts.q?.trim().toLowerCase()
  return posts.filter((p) => {
    if (label !== 'all' && p.predicted_label !== label) return false
    if (q && !p.tweet.toLowerCase().includes(q) && !p.id.includes(q)) return false
    const day = (p.timestamp || '').split('T')[0]
    if (opts.since && day && day < opts.since) return false
    if (opts.until && day && day > opts.until) return false
    if (opts.hateMin != null && !Number.isNaN(opts.hateMin) && p.probabilities.hate < opts.hateMin) {
      return false
    }
    if (opts.hateMax != null && !Number.isNaN(opts.hateMax) && p.probabilities.hate > opts.hateMax) {
      return false
    }
    return true
  })
}
