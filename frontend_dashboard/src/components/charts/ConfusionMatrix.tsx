interface ConfusionMatrixProps {
  matrix: number[][]
}

const labels = ['Normal', 'Abuse', 'Hate']

const cellColors = (value: number, max: number) => {
  if (max === 0) return 'bg-blue-50'
  const intensity = value / max
  if (intensity > 0.8) return 'bg-blue-600 text-white'
  if (intensity > 0.5) return 'bg-blue-400 text-white'
  if (intensity > 0.2) return 'bg-blue-200 text-blue-900'
  return 'bg-blue-50 text-blue-900'
}

export function ConfusionMatrix({ matrix }: ConfusionMatrixProps) {
  const maxVal = Math.max(...matrix.flat(), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_1fr] gap-0">
        <div />
        <div className="grid grid-cols-3">
          {labels.map((l) => (
            <div key={l} className="text-center text-xs font-medium text-muted-foreground p-2">
              Predicted {l}
            </div>
          ))}
        </div>
      </div>

      {matrix.map((row, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr] gap-0">
          <div className="text-left text-xs font-medium text-muted-foreground flex items-center pr-4">
            Actual {labels[i]}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {row.map((cell, j) => (
              <div
                key={j}
                className={`text-center p-3 rounded-lg text-sm font-bold ${cellColors(cell, maxVal)}`}
              >
                {cell.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-xs text-muted-foreground text-center mt-2">
        Diagonal = correct predictions. Off-diagonal = misclassifications.
      </div>
    </div>
  )
}
