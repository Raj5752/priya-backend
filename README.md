# Priya Backend — Setup

## 1. Install dependencies
```
npm install
```

## 2. Configure environment
Copy `.env.example` to `.env` and fill in:
- `SUPABASE_URL` — already set to your project
- `SUPABASE_SERVICE_KEY` — Dashboard → Project Settings → API → `service_role` key (keep secret!)
- `LLM_API_KEY` — your Anthropic (or other provider) API key

## 3. Run
```
npm start
```
Server runs on `http://localhost:3000`

## Endpoints
- `POST /chat` — body `{ "message": "hey priya" }` → returns `{ "reply": "..." }`
- `POST /memory` — body `{ "fact": "user's name is Raj", "category": "personal" }` → manually add a memory fact
- `GET /history` — returns full chat history

## Deploy
Push this to a GitHub repo, then deploy on Vercel (as a serverless function) or Railway/Render
(simpler for a long-running Express server). Set the same env vars in the deploy dashboard.

## Notes
- `service_role` key bypasses row-level security — fine for personal single-user use,
  but never expose it in frontend code or commit it to a public repo.
- Add `.env` to `.gitignore` before pushing to GitHub.
