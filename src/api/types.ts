export type SessionUser = {
  login: string
  full_name?: string
  role?: string
  is_admin?: boolean
}

export type AccountOverview = {
  login: string
  full_name?: string
  registered?: boolean
  can_register?: boolean
}

export type HealthStatus = {
  status: string
  openrouter_configured: boolean
  pgvector_configured: boolean
  default_model?: string
  user?: string
  role?: string
  is_admin?: boolean
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type MapDigestSummaryItem = {
  index?: number
  materials?: number
  chars?: number
}

export type MapDigestDetail = {
  content?: string
  materials?: number
  index?: number
}

export type MapDigestsListResponse = {
  items?: MapDigestSummaryItem[]
}

export type ApiDetail = {
  detail?: string
}

export type SaveDefaultPromptPayload = {
  variant: string
  system_prompt: string
  user_prompt: string
}

export type Job = {
  job_id: string
  status: JobStatus
  logs?: string[]
  error?: string | null
  cancel_requested?: boolean
  docx_path?: string | null
  docx_filename?: string | null
  result?: {
    content?: string
    brief_kind?: string
    map_digests_summary?: MapDigestSummaryItem[]
  }
}

export type WeeklyDefaultPromptResponse = {
  prompt?: string
  system_prompt?: string
  user_prompt?: string
  variant?: string
  customized?: boolean
}

export type WeeklyStagePromptResponse = {
  prompt?: string
  customized?: boolean
  variant?: string
}

export type CleanupBriefResponse = {
  content?: string
  cleanup_pass?: boolean
}

export type PeriodSource = {
  name: string
  kind?: 'web' | 'telegram' | 'document' | string
  brief?: string
  brief_label?: string
  topic_category?: string
  count: number
  custom?: boolean
}

export type AttachmentDoc = {
  id: number
  document_type?: string
  title?: string
  file_path?: string
  brief_date?: string
  period_end?: string
  chunks?: number
  indexed_by?: string
  created_at?: string
  source_type?: string
}

export type AttachmentMeta = {
  document_type: string
  title: string
  brief_date: string
  period_end: string
}

export type CustomChannel = {
  channel: string
  name?: string
  url?: string
  topic_category?: string
  added_by?: string
  kind?: string
  custom?: boolean
}

export type ManagedSource = {
  name: string
  kind?: string
  channel?: string
  url?: string
  custom?: boolean
  topic_category?: string
  brief?: string
  added_by?: string
}

export type CustomSourcesListResponse = {
  categories?: string[]
  channels?: CustomChannel[]
  sources?: ManagedSource[]
  disabled?: ManagedSource[]
}

export type AgentSource = {
  ref: number | string
  title: string
  url?: string | null
  source: string
  news_date: string
  kind?: string
}

export type AgentFullText = {
  title?: string
  url?: string | null
  source?: string
  news_date?: string
  text?: string
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}
