export type Language = 'igbo' | 'yoruba'

export type Label = 'Normal' | 'Abuse' | 'Hate'

export type LabelId = 0 | 1 | 2

export type TriageStatus = 'new' | 'reviewed' | 'reported'

export type XaiMethod = 'lime' | 'shap' | 'attention_rollout' | 'integrated_gradients'

export interface Post {
  id: string
  tweet: string
  label: Label
  label_id: LabelId
  language: Language
  split: string
  length: number
  predicted_label: Label
  predicted_label_id: LabelId
  probabilities: {
    normal: number
    abuse: number
    hate: number
  }
  flagged: boolean
  triage_status: TriageStatus
  timestamp: string
}

export interface TokenScore {
  token: string
  score: number
}

export interface LimeExplanation {
  method: 'lime'
  scores: [string, number][]
  predicted_label: Label
  fidelity_proxy: number
  error?: string
}

export interface TokenExplanation {
  method: XaiMethod
  tokens: string[]
  scores: TokenScore[]
  predicted_label?: Label
  error?: string
}

export type Explanation = LimeExplanation | TokenExplanation

export interface ExplanationPayload {
  id: string
  label: Label
  text: string
  methods: {
    lime?: LimeExplanation | { method: string; error: string }
    shap?: TokenExplanation | { method: string; error: string }
    attention_rollout?: TokenExplanation | { method: string; error: string }
    integrated_gradients?: TokenExplanation | { method: string; error: string }
  }
  metrics: {
    lime_faithfulness_aopc_proxy?: number
    lime_sparsity?: number
    lime_stability_jaccard?: number
    shap_faithfulness_aopc_proxy?: number
    shap_sparsity?: number
    attention_rollout_faithfulness_aopc_proxy?: number
    attention_rollout_sparsity?: number
    integrated_gradients_faithfulness_aopc_proxy?: number
    integrated_gradients_sparsity?: number
    cross_method_agreement_mean?: number
    agreement_lime_vs_shap?: number
    agreement_lime_vs_attention_rollout?: number
    agreement_lime_vs_integrated_gradients?: number
    agreement_shap_vs_attention_rollout?: number
    agreement_shap_vs_integrated_gradients?: number
    agreement_attention_rollout_vs_integrated_gradients?: number
  }
}

export interface PerClassMetrics {
  precision: number
  recall: number
  f1: number
  support: number
}

export interface ModelMetrics {
  accuracy: number
  macro_precision: number
  macro_recall: number
  macro_f1: number
  weighted_precision: number
  weighted_recall: number
  weighted_f1: number
  mcc: number
  support: number
  per_class: Record<Label, PerClassMetrics>
  confusion_matrix: number[][]
  classification_report: Record<string, unknown>
  roc_auc_ovr?: number | null
}

export interface DriftDataPoint {
  date: string
  normal_avg_confidence: number
  abuse_avg_confidence: number
  hate_avg_confidence: number
}

export interface VolumeDataPoint {
  hour: string
  normal_count: number
  abuse_count: number
  hate_count: number
  total: number
}

export interface PostCluster {
  cluster_id: number
  posts: Post[]
  representative_text: string
  size: number
}

export interface BatchResult {
  id: string
  tweet: string
  predicted_label: Label
  probabilities: {
    normal: number
    abuse: number
    hate: number
  }
}

export interface AlertItem {
  id: string
  type: 'hate_threshold' | 'volume_spike' | 'model_drift'
  message: string
  severity: 'low' | 'medium' | 'high'
  timestamp: string
  read: boolean
  post_id?: string
}
