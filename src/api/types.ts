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
  }
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
  url?: string
  topic_category?: string
  added_by?: string
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
