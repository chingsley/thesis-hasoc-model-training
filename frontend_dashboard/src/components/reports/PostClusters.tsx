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

  if (clusters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No similar post clusters detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {clusters.length} cluster{clusters.length > 1 ? 's' : ''} detected via embedding similarity
      </p>
      {clusters.map((cluster) => (
        <Card key={cluster.cluster_id} className="rounded-xl shadow-sm">
          <Collapsible
            open={openClusters[cluster.cluster_id]}
            onOpenChange={() =>
              setOpenClusters((prev) => ({ ...prev, [cluster.cluster_id]: !prev[cluster.cluster_id] }))
            }
          >
            <CollapsibleTrigger>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Cluster #{cluster.cluster_id + 1}</CardTitle>
                    <Badge variant="outline">{cluster.size} posts</Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${openClusters[cluster.cluster_id] ? 'rotate-180' : ''}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {cluster.representative_text}
                </p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {cluster.posts.map((post) => (
                    <div key={post.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex gap-2 mb-1">
                        <Badge variant={post.label === 'Hate' ? 'destructive' : 'default'}>{post.label}</Badge>
                        <Badge variant="outline">{post.id}</Badge>
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
  )
}
