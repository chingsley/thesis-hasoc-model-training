import { StatsCards } from '@/components/dashboard/StatsCards'
import { useVolume } from '@/hooks/use-volume'
import { plainRangePhrase } from '@/lib/volume-plain'

/** Same overview stat strip as the technical view for plain-language overview. */
export function PlainStats() {
  const { mode, range, data } = useVolume()
  const points = data ?? []
  const phrase = plainRangePhrase(mode, range)

  return (
    <section aria-label="Summary of posts checked">
      <StatsCards volume={points} periodLabel={phrase} />
    </section>
  )
}