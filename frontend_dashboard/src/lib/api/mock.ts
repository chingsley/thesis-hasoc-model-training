import type {
  Post,
  ExplanationPayload,
  ModelMetrics,
  DriftDataPoint,
  VolumeDataPoint,
  PostCluster,
  BatchResult,
  AlertItem,
  Language,
  Label,
} from '@/lib/types'

const igboTexts: Record<Label, string[]> = {
  Normal: [
    'Ndewo, kedu ka unu mere taa?',
    'Anyi na-aga ahia taa maka izu ahia ohuru.',
    'Obi na-agu m egwu ugbua na-ekiri ihe nkiri ohuru.',
    'Nne m siri nri oma taa, anyi riri ofe onugbu.',
    'Echi bu ubochi oma ije ije n\'ogige.',
    'Aguru m akwukwo ohuru banyere akuko ihe mere eme.',
    'Umuaka na-agba boolu n\'ama egwuregwu.',
    'Anyi nwere ezumike na izu uka a, obi di m uto.',
    'Onye nkuzi anyi kuziri ihe omumu ohuru taa.',
    'Mmiri na-ezo echi ka ihu igwe na-egosi.',
    'Achoghi m iri nri oku ugbua.',
    'O nwere onye ma ebe anyi ga-ezute echi?',
    'Ihe m mere taa bu izu ike na ulo.',
    'Ekele m gi maka enyemaka gi nyeere m.',
    'Anyi ga-eme emume ncheta omumu nwa m nwanne.',
    'Oru ugbo na-aga nke oma n\'afo a.',
    'A na-ato uto na mmemme a na-eme n\'obodo anyi.',
    'Onye isi obodo kwuru okwu n\'uzo ohuru.',
    'Aga m aga Lagos n\'izu na-abia maka nzuko.',
    'Kedu ihe anyi ga-eri n\'abali taa?',
  ],
  Abuse: [
    'I bu onye nzuzu, uche gi adighi mma ma oli.',
    'Onye ahu bu onye ohi, egbula ya.',
    'Ginwa bu aghugho na onye ojoo.',
    'Umuaka ndi a amaghi ihe obula, ha bu onye ara.',
    'A cho m iti gi ihe maka ihe i mere.',
    'Unu bu ndi nzuzu na ndi efu, kwenem.',
    'I ji isi gi eme ihe, isi gi adighi mma.',
    'Apu gi n\'anya, mmadu ojoo.',
    'Onye ahu bu onye ukwu ego efu, o dighi uru.',
    'Ihe i kwuru taa ezughi ezi, ihe ojoo ka ikwu.',
    'Ndi be anyi adighi mma, ha kpoo gi afa ojoo.',
    'Ihe gi emeghi eme, njo ka i mere.',
    'Agaghi m ekwe ka onye ojoo a bata n\'ulo m.',
    'I nwere obi ojoo, ihe niile i na-eme di njo.',
    'Biko puo ebe a, onye ara.',
    'Ginwa na uche gi adighi mma, oga adi gi njo.',
    'Acho m igwa gi na i bu onye ara.',
    'Unu eburu uzo mebie ihe ndi a, onye njo.',
    'I ji ego eme ihe, onye ukwu ego njo.',
  ],
  Hate: [
    'Ndi Igbo ndi a bu ndi aghugho, ha kweghi ekwe.',
    'Onye Yoruba obula bu onye ojoo, anyi achoghi ha ebe a.',
    'Ndi Hausa ndia kporo ndi anyi oku, anyi ga-aza ha.',
    'Ndi be anyi aghaghi ibi na mba ozo, ha bu ndi iro.',
    'Onye ocha obula bu onye njo, ha zuru ala anyi.',
    'Ndi ala ozo ndi a biara ibibi obodo anyi.',
    'Umu nwanyi aghaghi igha n\'ulo esi nri, obu oru ha.',
    'Ndi ogbenye ndi a bu aru, ha kweghi iru oru.',
    'Onye okpukpere chi ozo bu onye iro anyi.',
    'Ndi be anyi aghaghi ilaghachi n\'obodo ha. Ha bu ndi njo.',
    'Ndi ochichi anyi bu ndi ori na ndi aghugho niile.',
    'Ndi ebo ozo a bu ndi njo, anyi achoghi ha ebe a.',
    'Onye anyi na-ekweghi na ya kwesiri inwu maka ihe ha kwere.',
    'Ndi ahia ndi a na-ere ahia ojoo, ha bu ndi iro anyi.',
    'Ndi ozo biara igbu anyi, anyi ga-ebu uzo gbuo ha.',
    'Onye no n\'obodo anyi nke esighi ebe a bu onye iro.',
    'Ndi okenye ndi a ekweghi ka anyi nwee oganihu.',
    'Ndi n\'azu anyi na-akpa nkata imebi anyi.',
    'Onye kwenyere n\'ihe anyi kweghi bu onye njo di egwu.',
    'Ndi nta akuko ndi a na-agha ugha, ha bu ndi iro obodo.',
  ],
}

const yorubaTexts: Record<Label, string[]> = {
  Normal: [
    'Bawo ni, se dada ni gbogbo yin?',
    'A nlo s\'oja loni lati ra awon nkan tuntun.',
    'Inu mi dun lati wo filmu tuntun yi.',
    'Iya mi se ounje to dun loni, a je iyan ati efo.',
    'Ola ni ojo to dara lati rin ni ogba.',
    'Mo ka iwe tuntun nipa itan aye.',
    'Awon omode nse boolu ni papa isere.',
    'A ni isinmi ni ose yi, inu mi dun.',
    'Oluko wa ko eko tuntun loni.',
    'Ojo nro ni ola gege bi asotele oju ojo.',
    'Nko fe jeun gbigbona bayi.',
    'Se enikeni mo ibi ti a o pade ni ola?',
    'Ohun ti mo se loni ni isinmi ni ile.',
    'Mo dupe lowo re fun iranlowo re.',
    'A o se ayeye ojo ibi omo iya mi.',
    'Ise oko nlo daradara ni odun yi.',
    'A n gbadun ara wa ni ayeye ilu wa.',
    'Olori ilu soro nipa ona tuntun.',
    'Mo nlo si Eko ni ose to nbo fun ipade.',
    'Kilo ma je ni ale yi?',
  ],
  Abuse: [
    'Omo ale ni e, e ko ni oye rara.',
    'Eniyan yen ni ole, e ma lu.',
    'Iwo ni arekereke ati eniyan buburu.',
    'Awon omode yi ko mo nkan kan, won ni were.',
    'Mo fe lu e nitori ohun ti o se.',
    'Eyin ni omugo ati were, gbo mi.',
    'O nlo ori re se nkan, ori re ko dara.',
    'Kuro niwaju mi, eniyan buburu.',
    'Eniyan na ni onigbowo asan, ko wulo.',
    'Ohun ti o so loni ko to, ohun buburu lo nso.',
    'Awon ebi mi ko dara, won npe e ni oruko buburu.',
    'Ohun ti o se ko dara, buburu lo se.',
    'Nko nile gba eniyan buburu yi wole mi.',
    'O ni okan buburu, gbogbo ohun ti o nse buburu.',
    'Jowo kuro nibi, were.',
    'Iwo ati oye re ko dara, yoo buru fun e.',
    'Mo fe so fun e pe iwo ni were.',
    'Eyin lo baje awon nkan yi, eniyan buburu.',
    'O nlo owo se nkan, onigbowo buburu.',
  ],
  Hate: [
    'Awon Igbo yi ni arekereke, won ko gbagbo.',
    'Eniyan Yoruba kankan ni buburu, a ko fe won nibi.',
    'Awon Hausa yi npe awon wa ni oku, a o da won lohun.',
    'Awon ebi wa gbodo lo si orile-ede mi, won ni ota.',
    'Oyinbo kankan ni buburu, won ji ile wa.',
    'Awon ajeji ti won wa pa ilu wa run.',
    'Awon obinrin gbodo wa ni ile sise, ise won ni.',
    'Awon talika yi ni egbin, won ko fe sise.',
    'Eniyan elesin mi ni ota wa.',
    'Awon ti won wa lati ibomiran gbodo pada si ilu won. Won ni ota.',
    'Awon oloselu wa ni ole ati arekereke gbogbo.',
    'Awon eya mi ni buburu, a ko fe won nibi.',
    'Eni ti a ko gbagbo ninu re ye lati ku nitori igbagbo won.',
    'Awon onisowo yi nta eran buburu, won ni ota wa.',
    'Awon mi wa lati pa wa, a o koko pa won.',
    'Eni to wa ni ilu wa ti ko wa lati ibi ni ota.',
    'Awon agbalagba yi ko je ka ni ilosiwaju.',
    'Awon to wa leyin wa nro lati ba wa je.',
    'Eni ti o gba ohun ti a ko gba ni ota nla.',
    'Awon oniroyin yi nparo, won ni ota ilu.',
  ],
}

const LIME_BASE_TOKENS_IGBO: Record<string, [string, number][]> = {
  Hate: [
    ['ndi', 0.42], ['anya', -0.35], ['agha', 0.28], ['njo', 0.25],
    ['aka', 0.22], ['ikwu', -0.18], ['ndu', 0.15], ['isi', 0.12],
    ['nke', -0.10], ['madu', 0.08], ['ozi', 0.06], ['ezi', -0.04],
  ],
  Abuse: [
    ['nzuzu', 0.38], ['ojoo', 0.32], ['ara', 0.26], ['aghi', 0.22],
    ['ebula', 0.18], ['eke', -0.15], ['ori', -0.12], ['ga', 0.10],
    ['madu', 0.08], ['ka', -0.06], ['uto', 0.05], ['oma', -0.03],
  ],
  Normal: [
    ['ndewo', 0.12], ['oma', 0.10], ['uto', 0.09], ['eke', 0.07],
    ['nke', -0.05], ['oji', 0.04], ['chi', -0.03], ['oma', 0.02],
    ['ututu', -0.01], ['nri', 0.01], ['nwanne', 0.01], ['ilo', 0.0],
  ],
}

const LIME_BASE_TOKENS_YORUBA: Record<string, [string, number][]> = {
  Hate: [
    ['awon', 0.40], ['buburu', 0.35], ['ota', 0.30], ['ilu', 0.25],
    ['eni', 0.20], ['fe', -0.18], ['ti', 0.15], ['wa', 0.12],
    ['nibi', -0.10], ['nla', 0.08], ['asi', 0.06], ['bo', -0.04],
  ],
  Abuse: [
    ['were', 0.38], ['omugo', 0.32], ['buburu', 0.26], ['nkan', 0.22],
    ['ori', 0.18], ['dudu', -0.15], ['oni', -0.12], ['won', 0.10],
    ['eniyan', 0.08], ['aso', -0.06], ['ile', 0.05], ['owo', -0.03],
  ],
  Normal: [
    ['bawo', 0.12], ['dara', 0.10], ['dun', 0.09], ['ilo', 0.07],
    ['ose', -0.05], ['nla', 0.04], ['ile', -0.03], ['iyami', 0.02],
    ['ni', -0.01], ['je', 0.01], ['omo', 0.01], ['eko', 0.0],
  ],
}

function generateSHAPTokenScores(tokens: string[], label: Label) {
  const baseScores = label === 'Hate' ? 0.3 : label === 'Abuse' ? 0.25 : 0.08
  return tokens.map((token) => ({
    token,
    score: (Math.random() * baseScores * 2 - baseScores) * (label === 'Normal' ? 1 : 2),
  }))
}

const labels: Label[] = ['Normal', 'Abuse', 'Hate']
const labelWeights = [0.55, 0.28, 0.17]

function pickLabel(): Label {
  const r = Math.random()
  if (r < labelWeights[0]) return 'Normal'
  if (r < labelWeights[0] + labelWeights[1]) return 'Abuse'
  return 'Hate'
}

function generateId(index: number, language: Language): string {
  return `${language}_${String(index).padStart(5, '0')}`
}

function generateProbabilities(label: Label) {
  const rand = [0.15 + Math.random() * 0.35, 0.15 + Math.random() * 0.35, 0.15 + Math.random() * 0.35]
  if (label === 'Normal') {
    rand[0] = 0.55 + Math.random() * 0.35
    rand[1] = Math.random() * 0.3
    rand[2] = Math.random() * 0.2
  } else if (label === 'Abuse') {
    rand[0] = Math.random() * 0.3
    rand[1] = 0.50 + Math.random() * 0.35
    rand[2] = Math.random() * 0.35
  } else {
    rand[0] = Math.random() * 0.2
    rand[1] = Math.random() * 0.35
    rand[2] = 0.55 + Math.random() * 0.35
  }
  const total = rand[0] + rand[1] + rand[2]
  return { normal: rand[0] / total, abuse: rand[1] / total, hate: rand[2] / total }
}

export function generateMockPosts(count = 200): Post[] {
  const posts: Post[] = []
  const langs: Language[] = ['igbo', 'yoruba']
  let idx = 0

  for (let i = 0; i < count; i++) {
    const language = langs[Math.floor(Math.random() * langs.length)]
    const label = pickLabel()
    const texts = language === 'igbo' ? igboTexts[label] : yorubaTexts[label]
    const tweet = texts[Math.floor(Math.random() * texts.length)]
    const probs = generateProbabilities(label)
    const isCorrect = Math.random() < 0.85

    const hoursAgo = Math.floor(Math.random() * 168)
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString()

    posts.push({
      id: generateId(++idx, language),
      tweet,
      label,
      label_id: labels.indexOf(label) as 0 | 1 | 2,
      language,
      split: Math.random() < 0.7 ? 'train' : Math.random() < 0.5 ? 'dev' : 'test',
      length: tweet.length,
      predicted_label: isCorrect ? label : labels[(labels.indexOf(label) + 1 + Math.floor(Math.random() * 2)) % 3],
      predicted_label_id: (isCorrect ? labels.indexOf(label) : (labels.indexOf(label) + 1 + Math.floor(Math.random() * 2)) % 3) as 0 | 1 | 2,
      probabilities: probs,
      flagged: label !== 'Normal' && Math.random() < 0.4,
      triage_status: label === 'Normal'
        ? 'new'
        : (['new', 'reviewed', 'reported'] as const)[Math.floor(Math.random() * 3)],
      timestamp,
    })
  }

  return posts
}

let mockPostsCache: Post[] | null = null

export function getMockPosts(): Post[] {
  if (!mockPostsCache) {
    mockPostsCache = generateMockPosts(200)
  }
  return mockPostsCache
}

export function generateMockExplanation(post: Post): ExplanationPayload {
  const tokens = post.tweet.split(/\s+/)
  const base = post.language === 'igbo'
    ? (LIME_BASE_TOKENS_IGBO[post.label] || LIME_BASE_TOKENS_IGBO.Normal)
    : (LIME_BASE_TOKENS_YORUBA[post.label] || LIME_BASE_TOKENS_YORUBA.Normal)

  const limeScores: [string, number][] = tokens.map((token, i) => {
    const baseToken = base[i % base.length]
    return [token, (baseToken?.[1] ?? 0) * (0.7 + Math.random() * 0.6)]
  })

  const shapTokens = generateSHAPTokenScores(tokens, post.label)
  const attTokens = generateSHAPTokenScores(tokens, post.label)
  const igTokens = generateSHAPTokenScores(tokens, post.label)

  const faithfulness = 0.25 + Math.random() * 0.5
  const sparsity = 0.15 + Math.random() * 0.45
  const stability = 0.6 + Math.random() * 0.35

  return {
    id: post.id,
    label: post.label,
    text: post.tweet,
    methods: {
      lime: {
        method: 'lime',
        scores: limeScores,
        predicted_label: post.predicted_label,
        fidelity_proxy: faithfulness,
      },
      shap: {
        method: 'shap',
        tokens,
        scores: shapTokens,
        predicted_label: post.predicted_label,
      },
      attention_rollout: {
        method: 'attention_rollout',
        tokens,
        scores: attTokens,
        predicted_label: post.predicted_label,
      },
      integrated_gradients: {
        method: 'integrated_gradients',
        tokens,
        scores: igTokens,
        predicted_label: post.predicted_label,
      },
    },
    metrics: {
      lime_faithfulness_aopc_proxy: faithfulness,
      lime_sparsity: sparsity,
      lime_stability_jaccard: stability,
      shap_faithfulness_aopc_proxy: faithfulness * (0.8 + Math.random() * 0.4),
      shap_sparsity: sparsity * (0.8 + Math.random() * 0.4),
      attention_rollout_faithfulness_aopc_proxy: faithfulness * (0.7 + Math.random() * 0.4),
      attention_rollout_sparsity: sparsity * (0.9 + Math.random() * 0.3),
      integrated_gradients_faithfulness_aopc_proxy: faithfulness * (0.85 + Math.random() * 0.3),
      integrated_gradients_sparsity: sparsity * (0.85 + Math.random() * 0.3),
      cross_method_agreement_mean: 0.45 + Math.random() * 0.35,
      agreement_lime_vs_shap: 0.4 + Math.random() * 0.4,
      agreement_lime_vs_attention_rollout: 0.35 + Math.random() * 0.4,
      agreement_shap_vs_attention_rollout: 0.5 + Math.random() * 0.35,
    },
  }
}

export function generateMockMetrics(): ModelMetrics {
  return {
    accuracy: 0.872,
    macro_precision: 0.851,
    macro_recall: 0.843,
    macro_f1: 0.846,
    weighted_precision: 0.869,
    weighted_recall: 0.872,
    weighted_f1: 0.870,
    mcc: 0.785,
    support: 3000,
    per_class: {
      Normal: { precision: 0.921, recall: 0.945, f1: 0.933, support: 2200 },
      Abuse: { precision: 0.784, recall: 0.752, f1: 0.768, support: 600 },
      Hate: { precision: 0.847, recall: 0.833, f1: 0.840, support: 200 },
    },
    confusion_matrix: [
      [2079, 89, 32],
      [98, 451, 51],
      [41, 35, 124],
    ],
    classification_report: {},
    roc_auc_ovr: 0.931,
  }
}

export function generateMockDriftData(): DriftDataPoint[] {
  const data: DriftDataPoint[] = []
  for (let i = 30; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    data.push({
      date,
      normal_avg_confidence: 0.82 + Math.random() * 0.12,
      abuse_avg_confidence: 0.68 + Math.random() * 0.2,
      hate_avg_confidence: 0.72 + Math.random() * 0.18,
    })
  }
  return data
}

export function generateMockVolumeData(): VolumeDataPoint[] {
  const data: VolumeDataPoint[] = []
  for (let i = 168; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 3600000)
    const hour = date.toISOString().slice(0, 13) + ':00'
    const normal = Math.floor(8 + Math.random() * 25)
    const abuse = Math.floor(2 + Math.random() * 8)
    const hate = Math.floor(Math.random() * 5)
    data.push({
      hour,
      normal_count: normal,
      abuse_count: abuse,
      hate_count: hate,
      total: normal + abuse + hate,
    })
  }
  return data
}

export function generateMockClusters(): PostCluster[] {
  const posts = getMockPosts()
  const hateAndAbuse = posts.filter(p => p.label === 'Hate' || p.label === 'Abuse')
  const shuffled = [...hateAndAbuse].sort(() => Math.random() - 0.5)

  const clusters: PostCluster[] = []
  const clusterCount = 4 + Math.floor(Math.random() * 4)
  let idx = 0
  const perCluster = Math.ceil(shuffled.length / clusterCount)

  for (let c = 0; c < clusterCount; c++) {
    const clusterPosts = shuffled.slice(idx, idx + perCluster)
    idx += perCluster
    if (clusterPosts.length === 0) continue
    clusters.push({
      cluster_id: c,
      posts: clusterPosts,
      representative_text: clusterPosts[0].tweet,
      size: clusterPosts.length,
    })
  }

  return clusters
}

export function mockBatchClassify(texts: string[], _language: Language): BatchResult[] {
  return texts.map((tweet, i) => {
    const label = pickLabel()
    return {
      id: `batch_${i}`,
      tweet,
      predicted_label: label,
      probabilities: generateProbabilities(label),
    }
  })
}

export function generateMockAlerts(): AlertItem[] {
  const alertTypes = ['hate_threshold', 'volume_spike', 'model_drift'] as const
  const severities = ['low', 'medium', 'high'] as const

  const messages: Record<string, string[]> = {
    hate_threshold: [
      'Post #ig_00042 crossed the Hate probability threshold (0.92)',
      'Post #yo_00018 flagged with Hate confidence 0.88',
      'Hate speech probability spike detected at 0.94',
      'High-confidence Hate post detected: id #ig_00067',
    ],
    volume_spike: [
      'Hate-labeled posts surged 400% in the last hour',
      'Abuse post volume doubled compared to baseline',
      'Abnormal post activity detected: +250% in 30 minutes',
    ],
    model_drift: [
      'Model confidence distribution shifting: -8% avg confidence this week',
      'Predicted Normal/Abuse ratio drifted 12% from training baseline',
      'Model may need retraining: average confidence dropped below 0.70',
    ],
  }

  const alerts: AlertItem[] = []
  for (let i = 0; i < 12; i++) {
    const type = alertTypes[Math.floor(Math.random() * alertTypes.length)]
    const msgs = messages[type]
    alerts.push({
      id: `alert_${i}`,
      type: type as 'hate_threshold' | 'volume_spike' | 'model_drift',
      message: msgs[Math.floor(Math.random() * msgs.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
      read: Math.random() < 0.6,
    })
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
