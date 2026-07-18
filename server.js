import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient.js';
import { PRIYA_SYSTEM_PROMPT, buildMemoryContext } from './priyaPrompt.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const HISTORY_LIMIT = 20;

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    await supabase.from('chat_history').insert({ role: 'user', message });

    const { data: history, error: historyErr } = await supabase
      .from('chat_history')
      .select('role, message')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (historyErr) throw historyErr;
    const orderedHistory = history.reverse();

    const { data: facts, error: factsErr } = await supabase
      .from('memory_facts')
      .select('fact');
    if (factsErr) throw factsErr;

    const systemPrompt = PRIYA_SYSTEM_PROMPT + buildMemoryContext(facts);

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
        max_tokens: 500,
        messages: llmMessages,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      throw new Error(`LLM API error: ${llmRes.status} ${errText}`);
    }

    const llmData = await llmRes.json();
    const reply = llmData.choices?.[0]?.message?.content ?? '
