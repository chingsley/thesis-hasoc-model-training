import type { ModelMetrics } from '@/lib/types'

interface ConfusionMatrixProps {
  metrics: ModelMetrics
}

const LABELS = ['Normal', 'Abuse', 'Hate']

export function ConfusionMatrix({ metrics }: ConfusionMatrixProps) {
  const matrix = metrics.confusion_matrix
  const maxVal = Math.max(...matrix.flat())

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-muted-foreground font-normal">Actual \ Predicted</th>
              {LABELS.map((l) => (
                <th key={l} className="p-2 font-medium">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={LABELS[i]}>
                <td className="p-2 font-medium text-muted-foreground">{LABELS[i]}</td>
                {row.map((cell, j) => {
                  const intensity = cell / maxVal
                  const isCorrect = i === j
                  return (
                    <td
                      key={j}
                      className="p-3 text-center font-mono rounded-lg"
                      style={{
                        backgroundColor: isCorrect
                          ? `hsla(142, 70%, 45%, ${0.15 + intensity * 0.5})`
                          : `hsla(0, 70%, 50%, ${0.1 + intensity * 0.4})`,
                      }}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="p-3 bg-muted rounded-xl">
          <p className="text-2xl font-bold text-primary">{(metrics.accuracy * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Accuracy</p>
        </div>
        <div className="p-3 bg-muted rounded-xl">
          <p className="text-2xl font-bold">{(metrics.macro_f1 * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Macro F1</p>
        </div>
        <div className="p-3 bg-muted rounded-xl">
          <p className="text-2xl font-bold">{metrics.mcc.toFixed(3)}</p>
          <p className="text-xs text-muted-foreground">MCC</p>
        </div>
        <div className="p-3 bg-muted rounded-xl">
          <p className="text-2xl font-bold">{metrics.roc_auc_ovr?.toFixed(3) ?? '—'}</p>
          <p className="text-xs text-muted-foreground">ROC-AUC</p>
        </div>
      </div>
    </div>
  )
}
