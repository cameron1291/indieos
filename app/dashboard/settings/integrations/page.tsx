'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Loader2, Save, Check, ChevronDown, ChevronUp, Link as LinkIcon,
  Apple, Info, FileText, Key,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrationCreds {
  asc_key_id: string
  asc_issuer_id: string
  asc_private_key: string
  google_service_account_json: string
}

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{number}</div>
      <div className="flex-1 pt-0.5">
        <p className="text-sm font-semibold text-white mb-1">{title}</p>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-1">{children}</div>
      </div>
    </div>
  )
}

function InstructionPanel({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/40">
      <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-violet-400 shrink-0" />
          <span className="text-sm font-medium text-zinc-300">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>
      {open && <div className="border-t border-zinc-700/50 p-4 space-y-4">{children}</div>}
    </div>
  )
}

export default function IntegrationsPage() {
  const [creds, setCreds] = useState<IntegrationCreds>({
    asc_key_id: '',
    asc_issuer_id: '',
    asc_private_key: '',
    google_service_account_json: '',
  })
  const [connected, setConnected] = useState({ apple: false, google: false })
  const [saving, setSaving] = useState<'apple' | 'google' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCreds()
  }, [])

  async function loadCreds() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setCreds({
        asc_key_id: data.asc_key_id ?? '',
        asc_issuer_id: data.asc_issuer_id ?? '',
        asc_private_key: data.asc_private_key ?? '',
        google_service_account_json: data.google_service_account_json ?? '',
      })
      setConnected({
        apple: !!(data.asc_key_id && data.asc_issuer_id && data.asc_private_key),
        google: !!data.google_service_account_json,
      })
    }
    setLoading(false)
  }

  async function saveApple() {
    if (!creds.asc_key_id || !creds.asc_issuer_id || !creds.asc_private_key) {
      toast.error('All three fields required for Apple')
      return
    }
    setSaving('apple')
    await upsertIntegration({ asc_key_id: creds.asc_key_id, asc_issuer_id: creds.asc_issuer_id, asc_private_key: creds.asc_private_key })
    setConnected(p => ({ ...p, apple: true }))
    toast.success('Apple App Store Connect connected')
    setSaving(null)
  }

  async function saveGoogle() {
    if (!creds.google_service_account_json) { toast.error('Service account JSON required'); return }
    try { JSON.parse(creds.google_service_account_json) } catch { toast.error('Invalid JSON — check your service account file'); return }
    setSaving('google')
    await upsertIntegration({ google_service_account_json: creds.google_service_account_json })
    setConnected(p => ({ ...p, google: true }))
    toast.success('Google Play Console connected')
    setSaving(null)
  }

  async function upsertIntegration(data: Partial<IntegrationCreds>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_integrations')
      .upsert({ user_id: user.id, ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) {
      if (error.code === '42P01') {
        toast.error('Run the Supabase migration first — check the browser console')
        console.info(`
-- Run this in Supabase SQL editor:
CREATE TABLE user_integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  asc_key_id TEXT,
  asc_issuer_id TEXT,
  asc_private_key TEXT,
  google_service_account_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own integrations" ON user_integrations
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        `)
      } else {
        toast.error(error.message)
      }
    }
  }

  function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCreds(p => ({ ...p, google_service_account_json: ev.target?.result as string ?? '' }))
    reader.readAsText(file)
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <LinkIcon className="h-6 w-6 text-violet-400" />
          <h1 className="text-2xl font-bold">Integrations</h1>
        </div>
        <p className="text-zinc-400 text-sm">Connect your app store accounts to enable automated metadata publishing and analytics syncing.</p>
      </div>

      {/* Apple App Store Connect ── */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <Apple className="h-5 w-5 text-zinc-200" />
              </div>
              <div>
                <CardTitle className="text-base">Apple App Store Connect</CardTitle>
                <CardDescription className="text-xs text-zinc-500">Publish listings, read analytics, manage metadata</CardDescription>
              </div>
            </div>
            {connected.apple && <Badge className="bg-green-900/60 text-green-300 border border-green-700"><Check className="mr-1 h-3 w-3" />Connected</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <InstructionPanel title="How to get your App Store Connect API key" defaultOpen={!connected.apple}>
            <StepCard number={1} title="Open App Store Connect">
              <p>Go to <strong className="text-zinc-200">appstoreconnect.apple.com</strong> and sign in with your Apple ID.</p>
            </StepCard>
            <StepCard number={2} title="Navigate to API Keys">
              <p>Click <strong className="text-zinc-200">Users and Access</strong> in the top navigation, then select the <strong className="text-zinc-200">Integrations</strong> tab.</p>
              <p>Click <strong className="text-zinc-200">App Store Connect API</strong> on the left sidebar.</p>
            </StepCard>
            <StepCard number={3} title="Create a new key">
              <p>Click the <strong className="text-zinc-200">+</strong> button. Give it a name (e.g. &quot;IndieOS&quot;) and set the role to <strong className="text-zinc-200">Developer</strong>.</p>
              <p>Click <strong className="text-zinc-200">Generate</strong>.</p>
            </StepCard>
            <StepCard number={4} title="Copy your credentials">
              <p>• <strong className="text-zinc-200">Key ID</strong> — shown next to your key name (e.g. ABCD123456)</p>
              <p>• <strong className="text-zinc-200">Issuer ID</strong> — shown at the top of the page (a UUID)</p>
              <p>• <strong className="text-zinc-200">Private key (.p8)</strong> — click <strong className="text-zinc-200">Download API Key</strong>. You can only download it once. Open the file and paste the full contents below (starts with <code className="bg-zinc-800 px-1 rounded text-zinc-300">-----BEGIN PRIVATE KEY-----</code>).</p>
            </StepCard>
          </InstructionPanel>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400">Key ID</Label>
                <Input value={creds.asc_key_id} onChange={e => setCreds(p => ({ ...p, asc_key_id: e.target.value }))}
                  placeholder="ABCD123456" className="mt-1 bg-zinc-800 border-zinc-700 text-sm font-mono" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Issuer ID</Label>
                <Input value={creds.asc_issuer_id} onChange={e => setCreds(p => ({ ...p, asc_issuer_id: e.target.value }))}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="mt-1 bg-zinc-800 border-zinc-700 text-sm font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Private key (.p8 contents)</Label>
              <Textarea value={creds.asc_private_key} onChange={e => setCreds(p => ({ ...p, asc_private_key: e.target.value }))}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...&#10;-----END PRIVATE KEY-----"
                className="mt-1 bg-zinc-800 border-zinc-700 text-xs font-mono min-h-28 resize-none" />
            </div>
          </div>

          <Button onClick={saveApple} disabled={saving === 'apple'} className="bg-zinc-700 hover:bg-zinc-600 text-white">
            {saving === 'apple' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {connected.apple ? 'Update Apple credentials' : 'Connect App Store Connect'}
          </Button>
        </CardContent>
      </Card>

      {/* Google Play Console ── */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <span className="text-xl">▶</span>
              </div>
              <div>
                <CardTitle className="text-base">Google Play Console</CardTitle>
                <CardDescription className="text-xs text-zinc-500">Publish listings, manage releases, sync analytics</CardDescription>
              </div>
            </div>
            {connected.google && <Badge className="bg-green-900/60 text-green-300 border border-green-700"><Check className="mr-1 h-3 w-3" />Connected</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <InstructionPanel title="How to get your Google Play service account" defaultOpen={!connected.google}>
            <StepCard number={1} title="Open Google Play Console">
              <p>Go to <strong className="text-zinc-200">play.google.com/console</strong> and sign in.</p>
            </StepCard>
            <StepCard number={2} title="Go to API access">
              <p>In the left sidebar, click <strong className="text-zinc-200">Setup</strong> → <strong className="text-zinc-200">API access</strong>.</p>
              <p>If prompted, link to a Google Cloud project (create one if needed — it&apos;s free).</p>
            </StepCard>
            <StepCard number={3} title="Create a service account">
              <p>Click <strong className="text-zinc-200">Create new service account</strong>. Follow the link to Google Cloud Console.</p>
              <p>Give it a name (e.g. &quot;IndieOS&quot;), click <strong className="text-zinc-200">Create and continue</strong>.</p>
              <p>Skip role assignment and click <strong className="text-zinc-200">Done</strong>.</p>
            </StepCard>
            <StepCard number={4} title="Create JSON key">
              <p>In the service account list, click the account you just created.</p>
              <p>Go to the <strong className="text-zinc-200">Keys</strong> tab → <strong className="text-zinc-200">Add key</strong> → <strong className="text-zinc-200">Create new key</strong> → <strong className="text-zinc-200">JSON</strong>.</p>
              <p>A <code className="bg-zinc-800 px-1 rounded text-zinc-300">.json</code> file will download — upload or paste it below.</p>
            </StepCard>
            <StepCard number={5} title="Grant permissions in Play Console">
              <p>Back in Play Console under API access, find your new service account and click <strong className="text-zinc-200">Grant access</strong>.</p>
              <p>Set the permission to <strong className="text-zinc-200">Release manager</strong> (or Admin for full access). Click <strong className="text-zinc-200">Apply</strong> and then <strong className="text-zinc-200">Save changes</strong>.</p>
            </StepCard>
          </InstructionPanel>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-zinc-400">Service account JSON</Label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300">
                <FileText className="h-3.5 w-3.5" />
                Upload .json file
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFile} />
              </label>
            </div>
            <Textarea
              value={creds.google_service_account_json}
              onChange={e => setCreds(p => ({ ...p, google_service_account_json: e.target.value }))}
              placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
              className="bg-zinc-800 border-zinc-700 text-xs font-mono min-h-32 resize-none"
            />
          </div>

          <Button onClick={saveGoogle} disabled={saving === 'google'} className="bg-zinc-700 hover:bg-zinc-600 text-white">
            {saving === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {connected.google ? 'Update Google credentials' : 'Connect Google Play'}
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 flex items-start gap-2">
          <Key className="h-3.5 w-3.5 mt-0.5 text-zinc-600 shrink-0" />
          All credentials are stored encrypted in Supabase with row-level security — only you can access them. They are never logged or shared.
        </p>
      </div>
    </div>
  )
}
