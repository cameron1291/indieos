-- ============================================================
-- LaunchPad — full schema
-- Run this in the Supabase SQL editor (once, in order)
-- ============================================================

-- Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  plan TEXT DEFAULT 'free', -- free | solo | studio
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  apps_limit INTEGER DEFAULT 2,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Apps registered by each user
CREATE TABLE IF NOT EXISTS apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_user TEXT,
  problem_solved TEXT,
  tone TEXT DEFAULT 'casual and helpful',
  app_store_url TEXT,
  play_store_url TEXT,
  website_url TEXT,
  bundle_id TEXT,
  platform TEXT DEFAULT 'both', -- ios | android | both
  keywords TEXT[] DEFAULT '{}',
  high_intent_phrases TEXT[] DEFAULT '{}',
  penalty_keywords TEXT[] DEFAULT '{}',
  boost_keywords TEXT[] DEFAULT '{}',
  reddit_subreddits TEXT[] DEFAULT '{}',
  facebook_groups TEXT[] DEFAULT '{}',
  min_score FLOAT DEFAULT 8.0,
  monitoring_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apps_updated_at ON apps;
CREATE TRIGGER apps_updated_at
  BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Community matches
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- reddit | facebook | hackernews | indiehackers
  post_text TEXT,
  post_url TEXT UNIQUE,
  group_or_sub TEXT,
  score FLOAT,
  classification_reason TEXT,
  opportunity_type TEXT, -- direct_request | pain_point | comparison | rejected
  suggested_reply TEXT,
  final_reply TEXT,
  status TEXT DEFAULT 'pending', -- pending | approved | rejected | posted | failed
  posted_at TIMESTAMPTZ,
  reply_detected BOOLEAN DEFAULT false,
  reply_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Store listing drafts
CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT, -- ios | android
  title TEXT,
  subtitle TEXT,
  keywords TEXT,
  description TEXT,
  short_description TEXT,
  whats_new TEXT,
  aso_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Screenshot sets
CREATE TABLE IF NOT EXISTS screenshot_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  template_id TEXT,
  slides JSONB,
  export_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pressure test results
CREATE TABLE IF NOT EXISTS pressure_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  idea_description TEXT,
  result JSONB,
  verdict TEXT, -- BUILD | DONT_BUILD | PIVOT
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Name availability checks
CREATE TABLE IF NOT EXISTS name_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  app_id UUID REFERENCES apps(id),
  names_checked JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Download stats cache
CREATE TABLE IF NOT EXISTS download_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  date DATE,
  downloads INTEGER DEFAULT 0,
  revenue_usd FLOAT DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  country TEXT,
  source TEXT, -- ios | android
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, date, country, source)
);

-- Legal documents generated
CREATE TABLE IF NOT EXISTS legal_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doc_type TEXT, -- privacy_policy | terms | eula
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawler run metadata
CREATE TABLE IF NOT EXISTS crawler_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  source TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  posts_scanned INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,
  errors TEXT
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshot_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pressure_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE name_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users see own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users see own apps" ON apps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own opportunities" ON opportunities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own listings" ON listings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own screenshots" ON screenshot_sets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own pressure tests" ON pressure_tests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own name checks" ON name_checks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own stats" ON download_stats FOR ALL USING (
  auth.uid() = (SELECT user_id FROM apps WHERE id = download_stats.app_id)
);
CREATE POLICY "Users see own legal docs" ON legal_docs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own crawler runs" ON crawler_runs
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM apps WHERE id = crawler_runs.app_id)
  );
CREATE POLICY "Users see own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
