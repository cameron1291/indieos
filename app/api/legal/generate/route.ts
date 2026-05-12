import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

const DOC_PROMPTS: Record<string, (ctx: { name: string; description: string; website: string; email: string; company: string; date: string }) => string> = {
  privacy: ctx => `Write a complete, legally sound Privacy Policy for a mobile app.

App: ${ctx.name}
Description: ${ctx.description}
Company/Developer: ${ctx.company}
Contact email: ${ctx.email}
Website: ${ctx.website}
Effective date: ${ctx.date}

Include sections: Introduction, Information We Collect, How We Use Information, Data Sharing, Data Retention, User Rights, Children's Privacy, Security, Third-Party Services, Changes to Policy, Contact.

Write in plain English. Return the full document as markdown.`,

  terms: ctx => `Write complete Terms of Service for a mobile app.

App: ${ctx.name}
Description: ${ctx.description}
Company/Developer: ${ctx.company}
Contact email: ${ctx.email}
Website: ${ctx.website}
Effective date: ${ctx.date}

Include sections: Acceptance, License, User Conduct, Intellectual Property, Disclaimers, Limitation of Liability, Termination, Governing Law, Changes, Contact.

Return the full document as markdown.`,

  eula: ctx => `Write a complete End User License Agreement (EULA) for a mobile app.

App: ${ctx.name}
Description: ${ctx.description}
Company/Developer: ${ctx.company}
Contact email: ${ctx.email}
Website: ${ctx.website}
Effective date: ${ctx.date}

Include sections: Grant of License, Restrictions, Ownership, No Warranties, Limitation of Liability, Termination, Governing Law.

Return the full document as markdown.`,
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, doc_type, app_name, description, company, email, website } = await request.json()

  if (!app_id || !doc_type || !app_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const promptFn = DOC_PROMPTS[doc_type]
  if (!promptFn) return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 })

  const ctx = {
    name: app_name,
    description: description ?? '',
    company: company ?? app_name,
    email: email ?? '',
    website: website ?? '',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  }

  try {
    const content = await callDeepSeek(
      'You are a legal document writer for mobile apps. Write clear, comprehensive, legally sound documents.',
      promptFn(ctx),
      3000,
      0.3,
    )

    // Replace existing doc of same type
    await supabase.from('legal_docs').delete().eq('app_id', app_id).eq('doc_type', doc_type)
    await supabase.from('legal_docs').insert({ app_id, user_id: user.id, doc_type, content })

    return NextResponse.json({ content })
  } catch (err) {
    console.error('[legal/generate]', err)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}
