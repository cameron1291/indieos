export type Plan = 'free' | 'solo' | 'studio'
export type Platform = 'ios' | 'android' | 'both'
export type OpportunityStatus = 'pending' | 'approved' | 'rejected' | 'posted' | 'failed'
export type OpportunityType = 'direct_request' | 'pain_point' | 'comparison' | 'rejected'
export type OpportunitySource = 'reddit' | 'facebook' | 'hackernews' | 'indiehackers'
export type ListingPlatform = 'ios' | 'android'
export type DocType = 'privacy_policy' | 'terms' | 'eula'
export type PressureTestVerdict = 'BUILD' | 'DONT_BUILD' | 'PIVOT'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string
  apps_limit: number
  onboarding_completed: boolean
  created_at: string
}

export interface App {
  id: string
  user_id: string
  name: string
  description: string | null
  target_user: string | null
  problem_solved: string | null
  tone: string
  app_store_url: string | null
  play_store_url: string | null
  website_url: string | null
  bundle_id: string | null
  platform: Platform
  keywords: string[]
  high_intent_phrases: string[]
  penalty_keywords: string[]
  boost_keywords: string[]
  reddit_subreddits: string[]
  facebook_groups: string[]
  min_score: number
  monitoring_active: boolean
  created_at: string
  updated_at: string
}

export interface Opportunity {
  id: string
  app_id: string
  user_id: string
  source: OpportunitySource
  post_text: string | null
  post_url: string | null
  group_or_sub: string | null
  score: number | null
  classification_reason: string | null
  opportunity_type: OpportunityType | null
  suggested_reply: string | null
  final_reply: string | null
  status: OpportunityStatus
  posted_at: string | null
  reply_detected: boolean
  reply_url: string | null
  created_at: string
}

export interface Listing {
  id: string
  app_id: string
  user_id: string
  platform: ListingPlatform | null
  title: string | null
  subtitle: string | null
  keywords: string | null
  description: string | null
  short_description: string | null
  whats_new: string | null
  aso_score: number | null
  created_at: string
}

export interface ScreenshotSet {
  id: string
  app_id: string
  user_id: string
  template_id: string | null
  slides: ScreenshotSlide[] | null
  export_url: string | null
  created_at: string
}

export interface ScreenshotSlide {
  headline: string
  body: string
  screenshot_url: string
  device: string
}

export interface PressureTest {
  id: string
  user_id: string
  idea_description: string | null
  result: PressureTestResult | null
  verdict: PressureTestVerdict | null
  created_at: string
}

export interface PressureTestResult {
  summary: string
  scores: {
    pain: ScoreDimension
    market: ScoreDimension
    competition: ScoreDimension & { named_competitors: string[] }
    pricing: ScoreDimension & { suggested_price: string }
    distribution: ScoreDimension
    build: ScoreDimension & { weeks_to_mvp: number }
    moat: ScoreDimension
    revenue: ScoreDimension & { arr_12mo: string; arr_24mo: string }
  }
  overall_score: number
  verdict: PressureTestVerdict
  verdict_reason: string
  biggest_risk: string
  pivot_suggestion: string
  first_steps: string[]
}

export interface ScoreDimension {
  score: number
  verdict: string
  detail: string
}

export interface NameCheck {
  id: string
  user_id: string
  app_id: string | null
  names_checked: NameCheckResult[]
  created_at: string
}

export interface NameCheckResult {
  name: string
  ios_available: boolean | null
  android_available: boolean | null
  domain_com: boolean | null
  domain_io: boolean | null
  domain_app: boolean | null
}

export interface DownloadStat {
  id: string
  app_id: string
  date: string
  downloads: number
  revenue_usd: number
  active_subscriptions: number
  country: string | null
  source: 'ios' | 'android'
  created_at: string
}

export interface LegalDoc {
  id: string
  app_id: string
  user_id: string
  doc_type: DocType
  content: string | null
  created_at: string
}

export interface CrawlerRun {
  id: string
  app_id: string
  source: OpportunitySource
  started_at: string
  completed_at: string | null
  posts_scanned: number
  opportunities_found: number
  errors: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'id'>
        Update: Partial<Profile>
        Relationships: []
      }
      apps: {
        Row: App
        Insert: Partial<App>
        Update: Partial<App>
        Relationships: []
      }
      opportunities: {
        Row: Opportunity
        Insert: Partial<Opportunity>
        Update: Partial<Opportunity>
        Relationships: []
      }
      listings: {
        Row: Listing
        Insert: Partial<Listing>
        Update: Partial<Listing>
        Relationships: []
      }
      screenshot_sets: {
        Row: ScreenshotSet
        Insert: Partial<ScreenshotSet>
        Update: Partial<ScreenshotSet>
        Relationships: []
      }
      pressure_tests: {
        Row: PressureTest
        Insert: Partial<PressureTest>
        Update: Partial<PressureTest>
        Relationships: []
      }
      name_checks: {
        Row: NameCheck
        Insert: Partial<NameCheck>
        Update: Partial<NameCheck>
        Relationships: []
      }
      download_stats: {
        Row: DownloadStat
        Insert: Partial<DownloadStat>
        Update: Partial<DownloadStat>
        Relationships: []
      }
      legal_docs: {
        Row: LegalDoc
        Insert: Partial<LegalDoc>
        Update: Partial<LegalDoc>
        Relationships: []
      }
      crawler_runs: {
        Row: CrawlerRun
        Insert: Partial<CrawlerRun>
        Update: Partial<CrawlerRun>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: Partial<Notification>
        Update: Partial<Notification>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
