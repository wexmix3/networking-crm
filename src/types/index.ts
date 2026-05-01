export type InteractionType = 'met' | 'emailed' | 'called' | 'dm' | 'other'

export type EnrichmentStatus = 'pending' | 'found' | 'not_found' | null

export interface Contact {
  id: string
  user_id: string
  name: string
  company: string | null
  role: string | null
  linkedin_url: string | null
  email: string | null
  phone: string | null
  source: string | null
  tags: string[]
  key_facts: string[]
  notes: string | null
  enrichment_status: EnrichmentStatus
  follow_up_date?: string | null
  created_at: string
  // joined
  last_interaction_date?: string | null
  days_since_contact?: number | null
  interaction_count?: number
}

export interface Interaction {
  id: string
  contact_id: string
  user_id: string
  type: InteractionType
  note: string | null
  interaction_date: string
  created_at: string
}

export interface DigestPreferences {
  id: string
  user_id: string
  email: string
  digest_enabled: boolean
  digest_day: number // 0=Sun, 1=Mon … 6=Sat
  stale_threshold_days: number
  created_at: string
}

export type StalenessLevel = 'fresh' | 'warm' | 'stale' | 'never'

export function stalenessLevel(days: number | null | undefined): StalenessLevel {
  if (days === null || days === undefined) return 'never'
  if (days <= 30) return 'fresh'
  if (days <= 60) return 'warm'
  return 'stale'
}

export function stalenessColor(level: StalenessLevel): string {
  switch (level) {
    case 'fresh': return 'bg-emerald-100 text-emerald-800'
    case 'warm': return 'bg-amber-100 text-amber-800'
    case 'stale': return 'bg-red-100 text-red-800'
    case 'never': return 'bg-gray-100 text-gray-600'
  }
}

export function stalenessLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'No contact yet'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}