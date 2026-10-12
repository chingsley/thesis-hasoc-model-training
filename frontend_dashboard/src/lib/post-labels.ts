import type { Label, Post } from '@/lib/types'

/** Model output — unchanged after a reviewer relabel. */
export function modelPrediction(post: Post): Label {
  return post.initial_model_prediction ?? post.predicted_label
}

/** Reviewer-assigned label when the post was relabelled. */
export function reviewerLabel(post: Post): Label | null {
  return post.relabelled ? post.predicted_label : null
}
