# Jarvis Learning System — Claude Code Brief

## Project Goal
Build an online learning repository that captures, stores, and retrieves knowledge from Jarvis interactions. The system learns facts, conversation summaries, and decisions from each chat, making future responses more personalized and contextual.

---

## Architecture Overview

### Data Flow
```
User Message (WebSocket)
    ↓
[RETRIEVE] Query Supabase → Get top 3-5 semantically similar learnings
    ↓
[INJECT] Add to system prompt: "Remember these facts: ..."
    ↓
Agent Loop (Claude/Gemini/Groq/OpenAI/Ollama)
    ↓
Response + Tool-Use
    ↓
[EXTRACT] Groq parses response → Extract facts, summary, decisions
    ↓
[STORE] Save to Supabase with pgvector embeddings
    ↓
Send Response to Client (WebSocket)
```

### Key Components

**1. Supabase Database (PostgreSQL + pgvector)**
- Table: `learnings`
  - `id` (uuid, primary key)
  - `type` (text: 'fact', 'summary', 'decision')
  - `content` (text: the learning)
  - `embedding` (vector(1536): semantic search)
  - `tags` (text[]: optional tags, e.g., ['work', 'project-x'])
  - `source_message` (text: original message that triggered extraction)
  - `status` (text: 'auto' or 'approved' — for curation)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

**2. Extraction Logic (Groq)**
- After agent responds, call Groq with prompt:
  ```
  Analyze this conversation exchange and extract:
  1. Facts: Specific information mentioned (e.g., "User has a dog named Max")
  2. Summary: What was discussed
  3. Decisions: Any decisions or action items
  
  Format as JSON:
  { "facts": [...], "summary": "...", "decisions": [...] }
  ```
- Parse JSON → store each as separate learnings row

**3. Retrieval Logic (Semantic Search)**
- On incoming query, generate embedding (use same model as storage)
- Query Supabase: `SELECT * FROM learnings WHERE embedding <-> query_embedding < 0.5 LIMIT 5`
- Format into system prompt injection

**4. Curation Dashboard**
- Route: `/dashboard`
- Simple React component or HTML + fetch
- Shows auto-extracted learnings (status='auto')
- User can approve/edit/delete
- Marks approved learnings as status='approved'

---

## Files to Create/Modify

### New Files

**`src/learning.ts`**
- Export functions:
  - `initSupabase()` — initialize Supabase client with `SUPABASE_URL`, `SUPABASE_KEY`
  - `storeLearning(type, content, tags, sourceMessage)` — insert into DB + generate embedding
  - `retrieveLearnings(query, limit=5)` — semantic search via pgvector
  - `approveLearning(id)` — mark as approved
  - `deleteLearning(id)` — soft or hard delete
  - `getLearningsForCuration()` — fetch auto-extracted pending approval

**`src/extraction.ts`**
- Export `extractLearnings(agentResponse, conversationContext)`
- Uses Groq API to parse response
- Returns `{ facts: [], summary: "", decisions: [] }`
- Handles JSON parse errors gracefully

**`src/learnings-routes.ts`**
- Express routes:
  - `GET /api/learnings` — list learnings (paginated, filter by status/type)
  - `POST /api/learnings/approve/:id` — approve learning
  - `DELETE /api/learnings/:id` — delete learning
  - `GET /api/learnings/dashboard` — fetch pending curation
  - `POST /api/learnings/extract` — manual extraction trigger (for testing)

**`public/dashboard.html`**
- Simple HTML + fetch
- Display pending learnings (status='auto')
- Approve/edit/delete buttons
- Tags editor
- Basic styling (same aesthetic as Jarvis mobile UI)

### Modified Files

**`.env.example`**
```
# Existing
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GROQ_API_KEY=...
# ... other existing keys

# NEW: Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

**`src/index.ts` (WebSocket Handler)**
Add to message handler, after user message received:

```typescript
// RETRIEVE: Get relevant learnings
const relevantLearnings = await retrieveLearnings(message.text, 5);
const learningContext = relevantLearnings.length
  ? `Remember these related facts:\n${relevantLearnings.map(l => `- ${l.content}`).join('\n')}`
  : '';

// INJECT: Add to system prompt or user message
// (Modify agent invocation to include learningContext)

// ... agent loop runs ...

// EXTRACT: After agent responds
const extracted = await extractLearnings(agentResponse, {
  userMessage: message.text,
  agentResponse: agentResponse
});

// STORE: Save each learning
for (const fact of extracted.facts) {
  await storeLearning('fact', fact, ['auto-extracted'], message.text);
}
await storeLearning('summary', extracted.summary, ['auto-extracted'], message.text);
for (const decision of extracted.decisions) {
  await storeLearning('decision', decision, ['auto-extracted'], message.text);
}
```

**`package.json`**
Add dependencies:
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0"
  }
}
```

---

## Implementation Steps

### Phase 1: Setup
1. Create Supabase project (free tier)
2. Run SQL to create `learnings` table + pgvector extension
3. Add env vars to `.env`
4. Create `src/learning.ts` with basic CRUD

### Phase 2: Extraction
1. Create `src/extraction.ts` with Groq prompt
2. Test extraction on sample conversations
3. Add error handling (JSON parse, API failures)

### Phase 3: Integration
1. Modify `src/index.ts` to hook retrieval + extraction
2. Test full flow: message → retrieval → agent → extraction → storage
3. Verify embeddings are generated correctly

### Phase 4: UI
1. Build curation dashboard (`public/dashboard.html`)
2. Add routes in `src/learnings-routes.ts`
3. Wire up approve/delete/edit flows

### Phase 5: Refinement
1. Adjust extraction prompt (iterate on quality)
2. Tune semantic search threshold
3. Add filters/sorting to dashboard
4. Performance optimization if needed

---

## Technical Details

### Embeddings
- Use OpenAI's `text-embedding-3-small` (1536 dims) or Groq's native embeddings if available
- Generate on storage, reuse for retrieval
- Cost: ~$0.02 per 1M tokens (negligible for learning)

### Extraction Quality
- Start with basic Groq prompt, iterate based on results
- Consider multi-turn: ask follow-up questions if extraction is ambiguous
- Add confidence score if needed

### Performance
- Retrieval adds ~100-200ms per query (Supabase latency)
- Extraction adds ~500ms-1s per response (Groq API call)
- Consider async extraction if latency becomes issue

### Error Handling
- Graceful degradation: if retrieval fails, skip and continue
- If extraction fails, log but don't block response
- Retry logic for Supabase/Groq API calls

---

## Environment Setup (Supabase)

**SQL to run in Supabase:**
```sql
-- Enable pgvector
create extension if not exists vector;

-- Create learnings table
create table learnings (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('fact', 'summary', 'decision')),
  content text not null,
  embedding vector(1536),
  tags text[] default '{}',
  source_message text,
  status text default 'auto' check (status in ('auto', 'approved')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Create index for fast semantic search
create index on learnings using ivfflat (embedding vector_cosine_ops);

-- Row-level security (optional, for multi-user setup later)
alter table learnings enable row level security;
```

---

## Testing Checklist

- [ ] Supabase connection works
- [ ] Extraction parses sample responses correctly
- [ ] Embeddings are generated and stored
- [ ] Semantic search returns relevant results
- [ ] WebSocket integration doesn't break existing flow
- [ ] Dashboard loads and approves/deletes learnings
- [ ] Latency impact on chat is <1s
- [ ] Env vars are correct and secure

---

## Deployment Notes

- Render: Env vars already configured for `GROQ_API_KEY`, add `SUPABASE_URL` + `SUPABASE_KEY`
- Auto-deploy on push to `main` (existing GitHub Actions)
- No database migrations needed; Supabase handles schema
- Monitor Supabase usage in free tier (100K rows is plenty)

---

## Success Criteria

1. ✅ Jarvis extracts facts/decisions from every conversation
2. ✅ Next message uses relevant learnings to personalize response
3. ✅ User can curate learnings via dashboard
4. ✅ Semantic search finds related context (not just keywords)
5. ✅ No latency regression (<500ms added per chat)
6. ✅ Graceful fallback if learning system is unavailable

---

## Open Questions (for iteration)

- Should extraction happen synchronously or async?
- How many retrieved learnings to inject (currently 5)?
- Should Jarvis proactively mention retrieved facts to user?
- Auto-delete old learnings after N days?
- Multi-user support later (currently single-user)?

---

## Next Step

Start with Phase 1 (Supabase setup + `src/learning.ts`). Test retrieval/storage before hooking into WebSocket flow.
