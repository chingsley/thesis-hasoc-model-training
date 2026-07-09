import type { ToxicTerm } from '@/lib/types'
import { getMockPosts } from '@/lib/api/mock'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ToxicWordCloudProps {
  terms: ToxicTerm[]
}

export function ToxicWordCloud({ terms }: ToxicWordCloudProps) {
  if (terms.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No toxic terms to display</p>
  }

  const maxScore = Math.max(...terms.map((t) => t.score), 1)
  const posts = getMockPosts()

  return (
    <div className="flex flex-wrap justify-center gap-2 p-6 min-h-[220px] items-center">
      {terms.map(({ text, score, example_post_ids }) => {
        const ratio = score / maxScore
        const fontSize = 12 + ratio * 36
        const examples = example_post_ids
          .map((id) => posts.find((p) => p.id === id))
          .filter(Boolean)
          .slice(0, 3)

        return (
          <Tooltip key={text}>
            <TooltipTrigger
              render={
                <span
                  style={{
                    fontSize: `${fontSize}px`,
                    color: `hsl(0, ${60 + ratio * 30}%, ${45 - ratio * 20}%)`,
                  }}
                  className="px-1 py-0.5 rounded cursor-pointer hover:bg-accent transition-colors"
                >
                  {text}
                </span>
              }
            />
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Score: {score.toFixed(2)}</p>
              {examples.length > 0 ? (
                <ul className="text-xs space-y-1">
                  {examples.map((p) => (
                    <li key={p!.id} className="line-clamp-2">{p!.tweet}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs">No example posts</p>
              )}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
