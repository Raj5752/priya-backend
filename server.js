import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';
import { PRIYA_SYSTEM_PROMPT, buildMemoryContext } from './priyaPrompt.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const HISTORY_LIMIT = 20; // how many recent messages to send as context

// ---- POST /chat  { message: string } -> { reply: string } ----
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // 1. Save the user's message
    await supabase.from('chat_history').insert({ role: 'user', message });

    // 2. Fetch recent chat history for context
    const { data: history, error: historyErr } = await supabase
      .from('chat_history')
      .select('role, message')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (historyErr) throw historyErr;
    const orderedHistory = history.reverse();

    // 3. Fetch stored memory facts
    const { data: facts, error: factsErr } = await supabase
      .from('memory_facts')
      .select('fact');
    if (factsErr) throw factsErr;

    // 4. Build system prompt with memory injected
    const systemPrompt = PRIYA_SYSTEM_PROMPT + buildMemoryContext(facts);

    // 5. Call the LLM (Groq — free, OpenAI-compatible chat completions format)
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...orderedHistory.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.message,
      })),
    ];

    const llmRes = await fetch(process.env.LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        max_tokens: 120
        messages: llmMessages,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      throw new Error(`LLM API error: ${llmRes.status} ${errText}`);
    }

    const llmData = await llmRes.json();
    const reply = llmData.choices?.[0]?.message?.content ?? '...';

    // 6. Save Priya's reply
    await supabase.from('chat_history').insert({ role: 'assistant', message: reply });

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});

// ---- POST /memory  { fact: string, category?: string } -> add a memory fact manually ----
app.post('/memory', async (req, res) => {
  try {
    const { fact, category } = req.body;
    if (!fact) return res.status(400).json({ error: 'fact is required' });
    const { data, error } = await supabase
      .from('memory_facts')
      .insert({ fact, category })
      .select();
    if (error) throw error;
    res.json({ saved: data[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /history -> last N messages ----
app.get('/history', async (req, res) => {
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ history: data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Priya backend running on port ${PORT}`));
