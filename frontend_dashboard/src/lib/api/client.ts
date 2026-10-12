import type {
  Post,
  ExplanationPayload,
  ModelMetrics,
  DriftDataPoint,
  VolumeDataPoint,
  BatchResult,
  AlertItem,
  Language,
  Label,
  User,
  LoginResponse,
  ApiKeyInfo,
  ApiKeyCreatedResponse,
  InviteCreatedResponse,
  InviteInfo,
  OrganizationInfo,
  OverviewStats,
  XaiMethod,
  TriageStatus,
} from '@/lib/types';
import {
  getMockPosts,
  generateMockExplanation,
  generateMockMetrics,
  generateMockDriftData,
  generateMockVolumeData,
  mockBatchClassify,
  generateMockAlerts,
} from './mock';
import { BATCH_SIZE, USE_MOCK } from './config';
import { apiFetch, ApiError, type BatchPredictResponse, type PredictResponse } from './http';

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export type FetchPostsOptions = {
  limit?: number;
  /** Filter by model output (matches Explainability prediction pills). */
  modelLabel?: 'Normal' | 'Abuse' | 'Hate';
};

export async function fetchPosts(
  language: Language,
  options?: number | FetchPostsOptions,
): Promise<Post[]> {
  const opts: FetchPostsOptions =
    typeof options === 'number' ? { limit: options } : (options ?? {});
  const limit = opts.limit ?? 500;

  if (USE_MOCK) {
    const { modelPrediction } = await import('@/lib/post-labels');
    let all = getMockPosts().filter((p) => p.language === language);
    if (opts.modelLabel) {
      all = all.filter((p) => modelPrediction(p) === opts.modelLabel);
    }
    return delay(all.slice(0, limit));
  }
  const params = new URLSearchParams({ language, limit: String(limit) });
  if (opts.modelLabel) params.set('model_label', opts.modelLabel);
  return apiFetch<Post[]>(`/predictions?${params.toString()}`);
}

export async function fetchTriagePosts(language: Language): Promise<Post[]> {
  if (USE_MOCK) {
    const posts = await fetchPosts(language);
    return posts.filter((p) => p.predicted_label === 'Hate' || p.predicted_label === 'Abuse');
  }
  // Legacy list for Explainability; triage UI uses /predictions/triage/posts.
  return apiFetch<Post[]>(`/predictions?language=${language}&label=Hate,Abuse&limit=500`);
}

export async function fetchTriageStats(language: Language) {
  if (USE_MOCK) {
    const { triageStatsFromPosts } = await import('@/lib/triage-buckets');
    const posts = await fetchTriagePosts(language);
    return delay(triageStatsFromPosts(posts));
  }
  return apiFetch<import('@/lib/types').TriageStatsData>(
    `/predictions/triage/stats?language=${language}`,
  );
}

export type TriagePostsQuery = {
  language: Language;
  bucket: import('@/lib/types').TriageBucket;
  limit: number;
  offset: number;
  label?: 'Normal' | 'Hate' | 'Abuse';
  q?: string;
  since?: string;
  until?: string;
  hateMin?: number;
  hateMax?: number;
};

export async function fetchTriagePostsPage(query: TriagePostsQuery) {
  if (USE_MOCK) {
    const { bucketPosts, filterTriagePosts } = await import('@/lib/triage-buckets');
    const toxic = await fetchTriagePosts(query.language);
    const inBucket = bucketPosts(toxic)[query.bucket];
    const filtered = filterTriagePosts(inBucket, {
      label: query.label ?? 'all',
      q: query.q,
      since: query.since,
      until: query.until,
      hateMin: query.hateMin,
      hateMax: query.hateMax,
    });
    const items = filtered.slice(query.offset, query.offset + query.limit);
    return delay({
      items,
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    });
  }
  const params = new URLSearchParams({
    language: query.language,
    bucket: query.bucket,
    limit: String(query.limit),
    offset: String(query.offset),
  });
  if (query.label) params.set('label', query.label);
  if (query.q) params.set('q', query.q);
  if (query.since) params.set('since', query.since);
  if (query.until) params.set('until', query.until);
  if (query.hateMin != null) params.set('hate_min', String(query.hateMin));
  if (query.hateMax != null) params.set('hate_max', String(query.hateMax));
  return apiFetch<import('@/lib/types').TriagePostsPage>(
    `/predictions/triage/posts?${params.toString()}`,
  );
}

const TRIAGE_EXPORT_PAGE_SIZE = 500;

/** Fetch every post matching the triage filters (paginated on the server). */
export async function fetchAllTriagePostsMatching(
  query: Omit<TriagePostsQuery, 'limit' | 'offset'>,
): Promise<import('@/lib/types').Post[]> {
  const all: import('@/lib/types').Post[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const page = await fetchTriagePostsPage({
      ...query,
      limit: TRIAGE_EXPORT_PAGE_SIZE,
      offset,
    });
    all.push(...page.items);
    total = page.total;
    offset += page.items.length;
    if (page.items.length === 0) break;
  }
  return all;
}

export async function fetchExplanationMethod(
  post: Post,
  method: XaiMethod
): Promise<ExplanationPayload> {
  if (USE_MOCK) {
    const full = generateMockExplanation(post);
    return delay(
      { ...full, methods: { [method]: full.methods[method] } } as ExplanationPayload,
      300
    );
  }
  // One method per request: the page fires all four in parallel and renders
  // each panel as it lands; the backend caches each (language, methods, text).
  const payload = await apiFetch<ExplanationPayload>('/explain', {
    method: 'POST',
    body: JSON.stringify({ text: post.tweet, language: post.language, methods: [method], post_id: post.id }),
  });
  const entry = payload.methods?.[method];
  // Treat per-method dependency/runtime failures as query errors so react-query
  // does not permanently cache an empty explanation (staleTime is Infinity).
  if (entry && typeof entry === 'object' && 'error' in entry) {
    throw new ApiError(503, String((entry as { error: string }).error));
  }
  return payload;
}

export async function fetchModelMetrics(language: Language): Promise<ModelMetrics> {
  if (USE_MOCK) {
    return delay(generateMockMetrics(), 150);
  }
  return apiFetch<ModelMetrics>(`/metrics?language=${language}`);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ status: string; }>('/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort: the local session is cleared regardless of the server response.
  }
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>('/auth/me');
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<User> {
  return apiFetch<User>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function fetchApiKeys(): Promise<ApiKeyInfo[]> {
  return apiFetch<ApiKeyInfo[]>('/auth/keys');
}

export async function createApiKey(
  name: string,
  organizationId?: number,
): Promise<ApiKeyCreatedResponse> {
  return apiFetch<ApiKeyCreatedResponse>('/auth/keys', {
    method: 'POST',
    body: JSON.stringify({
      name,
      ...(organizationId != null ? { organization_id: organizationId } : {}),
    }),
  });
}

export async function revokeApiKey(keyId: number): Promise<void> {
  await apiFetch<{ status: string }>(`/auth/keys/${keyId}`, { method: 'DELETE' });
}

export async function fetchUserInvites(): Promise<InviteInfo[]> {
  return apiFetch<InviteInfo[]>('/auth/invites');
}

export async function createUserInvite(
  email: string,
  organizationId?: number,
): Promise<InviteCreatedResponse> {
  return apiFetch<InviteCreatedResponse>('/auth/invites', {
    method: 'POST',
    body: JSON.stringify({
      email,
      ...(organizationId != null ? { organization_id: organizationId } : {}),
    }),
  });
}

export async function revokeUserInvite(inviteId: number): Promise<void> {
  await apiFetch<{ status: string }>(`/auth/invites/${inviteId}`, { method: 'DELETE' });
}

export async function fetchOrganizations(): Promise<OrganizationInfo[]> {
  return apiFetch<OrganizationInfo[]>('/auth/organizations');
}

export async function createOrganization(name: string): Promise<OrganizationInfo> {
  return apiFetch<OrganizationInfo>('/auth/organizations', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function setActiveOrganization(organizationId: number): Promise<User> {
  return apiFetch<User>('/auth/session/organization', {
    method: 'POST',
    body: JSON.stringify({ organization_id: organizationId }),
  });
}

export async function fetchOverviewStats(language: Language): Promise<OverviewStats> {
  if (USE_MOCK) {
    return delay({ language, total: 42, normal: 20, abuse: 10, hate: 12 });
  }
  return apiFetch<OverviewStats>(`/stats/overview?language=${language}`);
}

export async function fetchDriftData(language: Language): Promise<DriftDataPoint[]> {
  if (USE_MOCK) {
    return delay(generateMockDriftData(), 200);
  }
  return apiFetch<DriftDataPoint[]>(`/analytics/drift?language=${language}`);
}

export async function fetchVolumeData(
  language: Language,
  options: { hours?: number; since?: string; until?: string; all?: boolean } = {},
): Promise<VolumeDataPoint[]> {
  const hours = options.hours ?? 24
  if (USE_MOCK) {
    if (options.all) {
      return delay(generateMockVolumeData(2160), 250);
    }
    return delay(generateMockVolumeData(hours, options.since, options.until), 250);
  }
  const params = new URLSearchParams({ language });
  if (options.all) {
    params.set('all', 'true');
  } else {
    params.set('hours', String(hours));
    if (options.since) params.set('since', options.since);
    if (options.until) params.set('until', options.until);
  }
  return apiFetch<VolumeDataPoint[]>(`/analytics/volume?${params.toString()}`);
}

export async function flagPost(postId: string): Promise<Post> {
  if (USE_MOCK) {
    const all = getMockPosts();
    const post = all.find((p) => p.id === postId);
    if (post) {
      post.flagged = true;
      post.triage_status = 'flagged';
    }
    return delay(post!, 150);
  }
  return apiFetch<Post>(`/predictions/${postId}/flag`, { method: 'POST' });
}

export async function updateTriageStatus(
  postId: string,
  status: TriageStatus
): Promise<Post> {
  if (USE_MOCK) {
    const all = getMockPosts();
    const post = all.find((p) => p.id === postId);
    if (post) {
      post.triage_status = status;
      post.flagged = status === 'flagged';
    }
    return delay(post!, 150);
  }
  return apiFetch<Post>(`/predictions/${postId}/triage`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function relabelPost(
  postId: string,
  label: Label,
  bucket?: 'flagged'
): Promise<Post> {
  if (USE_MOCK) {
    const all = getMockPosts();
    const post = all.find((p) => p.id === postId);
    if (post) {
      const wasRelabelled = post.relabelled;
      const initial = wasRelabelled ? post.initial_model_prediction : post.predicted_label;
      if (label === initial && wasRelabelled) {
        post.relabelled = false;
        post.initial_model_prediction = null;
        post.reviewer_id = null;
        post.reviewed_at = null;
        post.predicted_label = label;
        post.label = label;
      } else if (label !== post.predicted_label) {
        if (!wasRelabelled) {
          post.initial_model_prediction = post.predicted_label;
        }
        post.relabelled = true;
        post.predicted_label = label;
        post.label = label;
        post.reviewed_at = new Date().toISOString();
      }
      if (bucket) {
        post.triage_status = bucket;
        post.flagged = bucket === 'flagged';
      }
    }
    return delay(post!, 150);
  }
  return apiFetch<Post>(`/predictions/${postId}/relabel`, {
    method: 'POST',
    body: JSON.stringify(bucket ? { label, bucket } : { label }),
  });
}

export async function batchClassify(
  texts: string[],
  language: Language
): Promise<BatchResult[]> {
  if (USE_MOCK) {
    return delay(mockBatchClassify(texts, language), 500);
  }

  const results: BatchResult[] = [];
  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    const chunk = texts.slice(offset, offset + BATCH_SIZE);
    const data = await apiFetch<BatchPredictResponse>('/predict/batch', {
      method: 'POST',
      body: JSON.stringify({ texts: chunk, language }),
    });

    data.results.forEach((item, index) => {
      results.push({
        id: `batch_${offset + index}`,
        tweet: item.text,
        predicted_label: item.predicted_label as Label,
        probabilities: item.probabilities,
      });
    });
  }

  return results;
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  if (USE_MOCK) {
    return delay(generateMockAlerts(), 100);
  }
  return apiFetch<AlertItem[]>('/alerts');
}

export async function markAlertRead(alertId: string): Promise<void> {
  if (USE_MOCK) {
    return delay(undefined, 100);
  }
  await apiFetch<{ status: string; }>(`/alerts/${alertId}/read`, { method: 'POST' });
}

export interface WordCloudTerm {
  text: string;
  value: number;
  /** occurrences and per-occurrence toxicity drop — present only from /predictions/toxic-terms */
  count?: number;
  contribution?: number;
}

export async function fetchWordCloud(language: Language): Promise<WordCloudTerm[]> {
  return apiFetch<WordCloudTerm[]>(`/predictions/wordcloud?language=${language}`);
}

export async function fetchToxicTerms(language: Language): Promise<WordCloudTerm[]> {
  return apiFetch<WordCloudTerm[]>(`/predictions/toxic-terms?language=${language}`);
}

export interface SingleClassifyResult {
  predicted_label: string;
  probabilities: { normal: number; abuse: number; hate: number; };
  explanation?: ExplanationPayload;
  model_id?: string;
  used_fallback?: boolean;
  use_openai_moderation?: boolean;
}

export async function singleClassify(
  text: string,
  language: Language
): Promise<SingleClassifyResult> {
  if (USE_MOCK) {
    const result = mockBatchClassify([text], language)[0];
    const tempPost: Post = {
      id: 'mock_temp_test',
      tweet: text,
      label: result.predicted_label,
      label_id: ['Normal', 'Abuse', 'Hate'].indexOf(result.predicted_label) as 0 | 1 | 2,
      language,
      split: 'test',
      length: text.length,
      predicted_label: result.predicted_label,
      predicted_label_id: ['Normal', 'Abuse', 'Hate'].indexOf(result.predicted_label) as 0 | 1 | 2,
      probabilities: result.probabilities,
      flagged: false,
      triage_status: 'pending',
      relabelled: false,
      initial_model_prediction: null,
      reviewer_id: null,
      reviewed_at: null,
      timestamp: new Date().toISOString(),
    };
    return delay({ ...result, explanation: generateMockExplanation(tempPost) }, 400);
  }

  const data = await apiFetch<PredictResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  });

  // SHAP uses the local Afro-XLMR stack — skip when classification came from OpenAI.
  let explanation: ExplanationPayload | undefined;
  if (!data.use_openai_moderation) {
    try {
      explanation = await apiFetch<ExplanationPayload>('/explain', {
        method: 'POST',
        body: JSON.stringify({ text, language, methods: ['shap'] }),
      });
    } catch {
      explanation = undefined;
    }
  }

  return {
    predicted_label: data.predicted_label,
    probabilities: data.probabilities,
    explanation,
    model_id: data.model_id,
    used_fallback: data.used_fallback,
    use_openai_moderation: data.use_openai_moderation,
  };
}

/** @deprecated Use singleClassify instead */
export const mockSingleClassify = singleClassify;
