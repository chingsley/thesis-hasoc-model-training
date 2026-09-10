import { useMemo, useState } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import type { Post, PostCluster } from '@/lib/types'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { HateProbCell, PostIdCell, PredictionCell } from '@/components/dashboard/post-cells'
import { cn } from '@/lib/utils'

interface PostClustersProps {
  clusters: PostCluster[]
}

function labelMix(posts: Post[]) {
  let hate = 0
  let abuse = 0
  let other = 0
  for (const post of posts) {
    const label = post.predicted_label || post.label
    if (label === 'Hate') hate += 1
    else if (label === 'Abuse') abuse += 1
    else other += 1
  }
  const total = posts.length || 1
  return {
    hate,
    abuse,
    other,
    hatePct: (hate / total) * 100,
    abusePct: (abuse / total) * 100,
    otherPct: (other / total) * 100,
  }
}

function MixBar({ posts }: { posts: Post[] }) {
  const mix = labelMix(posts)
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--hg-canvas)]"
      title={`Hate ${mix.hate} · Abuse ${mix.abuse}${mix.other ? ` · Other ${mix.other}` : ''}`}
      aria-hidden
    >
      {mix.hatePct > 0 && (
        <div className="h-full bg-[var(--hg-secondary)]" style={{ width: `${mix.hatePct}%` }} />
      )}
      {mix.abusePct > 0 && (
        <div className="h-full bg-amber-500" style={{ width: `${mix.abusePct}%` }} />
      )}
      {mix.otherPct > 0 && (
        <div className="h-full bg-emerald-500/70" style={{ width: `${mix.otherPct}%` }} />
      )}
    </div>
  )
}

function ClusterKpiStrip({ clusters }: { clusters: PostCluster[] }) {
  const stats = useMemo(() => {
    const totalPosts = clusters.reduce((sum, c) => sum + c.size, 0)
    const largest = clusters.reduce((max, c) => Math.max(max, c.size), 0)
    let hate = 0
    let abuse = 0
    for (const cluster of clusters) {
      const mix = labelMix(cluster.posts)
      hate += mix.hate
      abuse += mix.abuse
    }
    const labeled = hate + abuse || 1
    return {
      totalPosts,
      largest,
      hateShare: Math.round((hate / labeled) * 100),
      abuseShare: Math.round((abuse / labeled) * 100),
    }
  }, [clusters])

  const items = [
    {
      label: 'Clusters',
      value: String(clusters.length),
      hint: 'Semantically similar groups',
    },
    {
      label: 'Posts grouped',
      value: String(stats.totalPosts),
      hint: 'Across all clusters',
    },
    {
      label: 'Largest cluster',
      value: String(stats.largest),
      hint: 'Posts in the biggest group',
    },
    {
      label: 'Label mix',
      value: `${stats.hateShare}% / ${stats.abuseShare}%`,
      hint: 'Hate / Abuse share',
    },
  ]

  return (
    <div className="flex flex-wrap items-stretch border-b border-[var(--hg-border)] pb-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'relative min-w-0 py-0.5 pr-8',
            index > 0 && 'pl-8',
          )}
        >
          {index > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 bottom-0.5 left-0 w-px bg-[var(--hg-border)]"
            />
          )}
          <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
            {item.label}
          </p>
          <p className="text-sm font-semibold tabular-nums text-[var(--hg-ink)]">{item.value}</p>
          <p className="truncate text-[10px] text-[var(--hg-muted)]">{item.hint}</p>
        </div>
      ))}
    </div>
  )
}

function ClusterRow({
  cluster,
  rank,
  open,
  onOpenChange,
}: {
  cluster: PostCluster
  rank: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mix = labelMix(cluster.posts)
  const indexLabel = String(rank).padStart(2, '0')

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          'overflow-hidden rounded-[4px] border border-[var(--hg-border)] bg-white transition-colors',
          open && 'border-[var(--hg-soft-selected)]',
        )}
      >
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
            'hover:bg-[var(--hg-canvas)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30',
          )}
        >
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-[var(--hg-canvas)] font-mono text-[11px] font-semibold tabular-nums text-[var(--hg-brand)]"
            aria-hidden
          >
            {indexLabel}
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-[var(--hg-ink)]">
                Cluster {rank}
              </span>
              <span className="rounded-[4px] bg-[var(--hg-canvas)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
                {cluster.size} posts
              </span>
              {mix.hate > 0 && (
                <span className="text-[11px] tabular-nums text-[var(--hg-secondary)]">
                  {mix.hate} hate
                </span>
              )}
              {mix.abuse > 0 && (
                <span className="text-[11px] tabular-nums text-amber-600">
                  {mix.abuse} abuse
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm leading-snug text-[var(--hg-ink)]">
              {cluster.representative_text}
            </p>
            <div className="max-w-xs pt-0.5">
              <MixBar posts={cluster.posts} />
            </div>
          </div>

          <ChevronDown
            className={cn(
              'mt-1 size-4 shrink-0 text-[var(--hg-subtle)] transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-[var(--hg-border)] bg-[var(--hg-canvas)]/40 px-3 py-2 sm:px-4">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                Posts in this cluster
              </p>
              <p className="text-[10px] text-[var(--hg-muted)]">
                Red = Hate · Amber = Abuse
              </p>
            </div>
            <ul className="max-h-[320px] space-y-1.5 overflow-auto pr-0.5">
              {cluster.posts.map((post) => (
                <li
                  key={post.id}
                  className="rounded-[4px] border border-[var(--hg-border)] bg-white px-3 py-2.5"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <PredictionCell label={post.predicted_label || post.label} />
                    <PostIdCell id={post.id} />
                    <div className="ml-auto">
                      <HateProbCell value={post.probabilities?.hate ?? 0} />
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--hg-ink)]">{post.tweet}</p>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function PostClusters({ clusters }: PostClustersProps) {
  const sorted = useMemo(
    () => [...clusters].sort((a, b) => b.size - a.size || a.cluster_id - b.cluster_id),
    [clusters],
  )

  const defaultOpenId = sorted[0]?.cluster_id
  const [openIds, setOpenIds] = useState<Record<number, boolean>>({})

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-[4px] bg-[var(--hg-canvas)]">
          <Layers className="size-5 text-[var(--hg-subtle)]" aria-hidden />
        </div>
        <p className="text-sm font-medium text-[var(--hg-ink)]">No similar clusters yet</p>
        <p className="max-w-sm text-xs text-[var(--hg-muted)]">
          Groups appear when enough Hate and Abuse posts share near-duplicate meaning — useful for spotting coordinated campaigns.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <ClusterKpiStrip clusters={sorted} />
      <div className="space-y-3">
        <p className="text-[11px] text-[var(--hg-muted)]">
          Expand a cluster to review member posts. Larger groups are listed first.
        </p>
        <div className="space-y-2.5">
          {sorted.map((cluster, index) => (
            <ClusterRow
              key={cluster.cluster_id}
              cluster={cluster}
              rank={index + 1}
              open={openIds[cluster.cluster_id] ?? cluster.cluster_id === defaultOpenId}
              onOpenChange={(open) =>
                setOpenIds((prev) => ({ ...prev, [cluster.cluster_id]: open }))
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}
