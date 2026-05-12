"""
scorer.py - Two-stage DeepSeek relevance classification and reply generation.
Stage 1: classify_relevance — strict binary classifier (score 0-4 or 8-10, no middle ground).
Stage 2: generate_reply — natural reply that sounds like a real person, never mentions app.
"""

import os
import json
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)
MODEL = "deepseek-chat"

JOB_AD_SIGNALS = [
    "hiring", "job description", "apply now", "full time", "full-time",
    "part time", "part-time", "we are looking for", "salary", "for sale",
    "selling my", " wtb ", " wts ", "wanted to buy", "job listing",
    "position available", "now recruiting", "open role",
]

CLASSIFY_SYSTEM = """
You are a strict relevance classifier protecting a developer's time.
Default to REJECTION. Only approve posts where someone genuinely
needs help that this specific app solves RIGHT NOW.

APPROVE (score 8-10) ONLY when:
- Person actively asks for a tool/app recommendation for this exact problem
- Person expresses current frustration with a manual process this app replaces
- Person is comparing tools in this category

REJECT without mercy when:
- Keyword appears but topic is unrelated
- Person venting generally, not seeking solution
- Job ad, hiring, for sale, spam
- Problem already solved
- Any ambiguity at all — REJECT

Scores 5-7 are FORBIDDEN. Score is either 0-4 (reject) or 8-10 (approve).

Return ONLY valid JSON, nothing else:
{"score": 0.0, "reason": "one sentence", "opportunity_type": "direct_request|pain_point|comparison|rejected"}
"""

REPLY_SYSTEM = """
You are writing a reply on behalf of a real person who solved the
exact same problem described in this post.

ABSOLUTE RULES — breaking these destroys the product:
1. NEVER mention any app name, URL, or product
2. NEVER say: check out, I built, download, try, shameless plug,
   game changer, I'd like to introduce
3. Sound like you personally experienced this exact frustration
4. Either ask a genuine question OR share a genuine observation
5. Goal: start a real conversation. NOT to advertise.
6. Maximum 3 sentences. Shorter is better.
7. If Reddit: direct, casual, no fluff
8. If Facebook: warm, like a friend in the industry

The reply must make the person feel understood, not marketed to.
If they respond and ask what you used — THEN mention the app.
Never in the first reply.
"""


def passes_strict_filter(post_text: str, app_config: dict) -> bool:
    """Zero-cost pre-filter before any API call."""
    if len(post_text) < 80:
        return False

    text_lower = post_text.lower()

    for signal in JOB_AD_SIGNALS:
        if signal in text_lower:
            return False

    penalty_keywords = app_config.get("scoring", {}).get("penalty_keywords", [])
    for kw in penalty_keywords:
        if kw.lower() in text_lower:
            return False

    high_intent = app_config.get("scoring", {}).get("high_intent_phrases", [])
    if high_intent:
        if not any(phrase.lower() in text_lower for phrase in high_intent):
            return False

    return True


def classify_relevance(post_text: str, app_config: dict) -> dict:
    """Stage 1: binary classify, score 0-4 or 8-10 only."""
    app_name = app_config.get("name", "")
    description = app_config.get("description", "")
    target_user = app_config.get("target_user", "")
    problem_solved = app_config.get("problem_solved", "")

    user_prompt = f"""App: {app_name}
Description: {description}
Target user: {target_user}
Problem solved: {problem_solved}

Post to classify:
---
{post_text[:1500]}
---

Classify this post's relevance to the app above."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": CLASSIFY_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=150,
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
        return {
            "score": float(result.get("score", 0)),
            "reason": result.get("reason", ""),
            "opportunity_type": result.get("opportunity_type", "rejected"),
        }
    except Exception as e:
        print(f"[Scorer Stage 1] Error: {e}")
        return {"score": 0.0, "reason": "Classification error", "opportunity_type": "rejected"}


def generate_reply(post_text: str, app_config: dict, source: str) -> str:
    """Stage 2: generate a natural reply. Only called when score >= 8."""
    tone_note = ""
    if source.lower() == "reddit":
        tone_note = "Platform: Reddit — be direct, casual, no fluff."
    elif source.lower() == "facebook":
        tone_note = "Platform: Facebook — be warm, like a friend in the industry."

    user_prompt = f"""App context:
Name: {app_config.get('name', '')}
Description: {app_config.get('description', '')}
Problem solved: {app_config.get('problem_solved', '')}
{tone_note}

Post that needs a reply:
---
{post_text[:1500]}
---

Write a reply that starts a genuine conversation. DO NOT mention the app."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": REPLY_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=200,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Scorer Stage 2] Error: {e}")
        return ""


def score_and_reply(post_text: str, app_config: dict, source: str) -> dict:
    """Main entry point for crawlers. Returns score, reasoning, suggested_reply."""

    # Stage 0: zero-cost pre-filter
    if not passes_strict_filter(post_text, app_config):
        return {"score": 0.0, "reasoning": "Failed strict filter", "suggested_reply": "", "opportunity_type": "rejected"}

    # Stage 1: classify
    classification = classify_relevance(post_text, app_config)
    score = classification["score"]

    if score < 8.0:
        return {
            "score": score,
            "reasoning": classification["reason"],
            "suggested_reply": "",
            "opportunity_type": classification["opportunity_type"],
        }

    # Stage 2: generate reply (only when score >= 8)
    reply = generate_reply(post_text, app_config, source)

    return {
        "score": score,
        "reasoning": classification["reason"],
        "suggested_reply": reply,
        "opportunity_type": classification["opportunity_type"],
    }


def generate_group_search_terms(app_config: dict) -> list[str]:
    """Generate Facebook group search terms for a given app config."""
    app_name = app_config.get("name", "")
    description = app_config.get("description", "")
    target_user = app_config.get("target_user", "")

    prompt = f"""Generate 20 Facebook group search terms for finding groups where potential users of this app would hang out.

App: {app_name}
Description: {description}
Target user: {target_user}

Rules:
- Mix of profession-specific, problem-specific, and community groups
- Real search terms someone would type into Facebook group search
- No brand names, just topic terms

Respond ONLY with a JSON array of strings, no markdown:
["term 1", "term 2", ...]"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=400,
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        terms = json.loads(raw)
        return terms if isinstance(terms, list) else []
    except Exception as e:
        print(f"[Scorer] Error generating search terms: {e}")
        return []
