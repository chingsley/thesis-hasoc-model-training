import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { fetchAlerts, fetchVolumeData, fetchPosts } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'

export function useAlerts() {
  const language = useDashboardStore((s) => s.language)
  const hateThreshold = useDashboardStore((s) => s.hateThreshold)
  const setAlerts = useDashboardStore((s) => s.setAlerts)
  const addAlert = useDashboardStore((s) => s.addAlert)
  const seenPostIds = useRef(new Set<string>())

  const query = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (query.data) setAlerts(query.data)
  }, [query.data, setAlerts])

  const volumeQuery = useQuery({
    queryKey: ['volume-alerts'],
    queryFn: fetchVolumeData,
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (!volumeQuery.data || volumeQuery.data.length < 25) return
    const recent = volumeQuery.data.slice(-25)
    const latest = recent[recent.length - 1]
    const avgHate = recent.slice(0, -1).reduce((s, p) => s + p.hate_count, 0) / (recent.length - 1)
    if (latest.hate_count > avgHate * 2 && latest.hate_count > 10) {
      addAlert({
        id: `spike_${latest.hour}`,
        type: 'volume_spike',
        message: `Hate post volume spike: ${latest.hate_count} posts in the last hour (${Math.round((latest.hate_count / avgHate - 1) * 100)}% above average)`,
        severity: latest.hate_count > avgHate * 3 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        read: false,
      })
    }
  }, [volumeQuery.data, addAlert])

  const postsQuery = useQuery({
    queryKey: ['posts-alerts', language, hateThreshold],
    queryFn: () => fetchPosts(language),
    refetchInterval: 45000,
  })

  useEffect(() => {
    if (!postsQuery.data) return
    for (const post of postsQuery.data) {
      if (post.probabilities.hate >= hateThreshold && post.predicted_label === 'Hate' && !seenPostIds.current.has(post.id)) {
        seenPostIds.current.add(post.id)
        addAlert({
          id: `threshold_${post.id}`,
          type: 'hate_threshold',
          message: `Post ${post.id} crossed Hate threshold (${Math.round(post.probabilities.hate * 100)}%)`,
          severity: post.probabilities.hate > 0.85 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          read: false,
          post_id: post.id,
        })
      }
    }
  }, [postsQuery.data, hateThreshold, addAlert])

  return query
}
