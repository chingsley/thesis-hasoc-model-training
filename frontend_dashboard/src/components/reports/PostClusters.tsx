import type { PostCluster } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useState } from 'react'
import { ChevronDown, Network } from 'lucide-react'

interface PostClustersProps {
  clusters: PostCluster[]
}

export function PostClusters({ clusters }: PostClustersProps) {
  const [openClusters, setOpenClusters] = useState<Record<number, boolean>>({})

  const toggleCluster = (id: number) => {
    setOpenClusters((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const labelVariant = (label: string) => {
    if (label === 'Hate') return 'destructive' as const
    if (label === 'Abuse') return 'default' as const
    return 'secondary' as const
  }

  if (clusters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No similar post clusters detected</p>
        <p className="text-xs mt-1">Clusters appear when semantically similar hate/abuse posts are grouped together</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {clusters.length} cluster{clusters.length > 1 ? 's' : ''} detected - groups of semantically similar posts that may indicate coordinated campaigns.
      </p>
      <div className="space-y-3">
        {clusters.map((cluster) => (
          <Card key={cluster.cluster_id}>
            <Collapsible open={openClusters[cluster.cluster_id]} onOpenChange={() => toggleCluster(cluster.cluster_id)}>
              <CollapsibleTrigger>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">Cluster #{cluster.cluster_id + 1}</CardTitle>
                      <Badge variant="outline" className="text-xs">{cluster.size} posts</Badge>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        openClusters[cluster.cluster_id] ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    Representative: {cluster.representative_text}
                  </p>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {cluster.posts.map((post) => (
                      <div key={post.id} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={labelVariant(post.label)} className="text-xs">
                            {post.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{post.id}</Badge>
                        </div>
                        <p className="text-sm">{post.tweet}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  )
}
