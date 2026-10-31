# Second Brain

**Demo: https://second-brain.nickylin1023.workers.dev**

A personal long-term memory assistant built for the Nebius x NVIDIA hackathon.
Save facts about yourself, your projects, and your preferences — then ask
questions and get answers grounded only in what you saved, with sources cited.

## How it works

- **Save** — every memory (title + text) is embedded with
  `Qwen/Qwen3-Embedding-8B` on **Nebius Token Factory** and stored, together
  with its vector, in Cloudflare KV.
- **Recall** — a question is embedded with the same model, cosine similarity
  ranks all stored memories, and the top 4 become the context.
- **Answer** — the NVIDIA open model **`nvidia/Nemotron-3.5-Super-VL`**
  (Nemotron 3.5 Super VL, fallback `nvidia/Nemotron-3_5-Lightning`) answers
  strictly from those memories and names the source titles it used. (As of Nov
  2026, Nebius replaced the prior Super 120B / Nano 30B chat models with these
  IDs; embeddings are unchanged.)

Everything runs in a single Cloudflare Worker that serves both the UI and the
JSON API. The Nebius API key is a Worker secret binding (`NEBIUS_API_KEY`) and
never appears in source code.

## API

| Method | Route | Body / result |
| --- | --- | --- |
| GET | `/` | Single-page UI |
| POST | `/api/memories` | `{title, text}` → embeds and stores |
| GET | `/api/memories` | List of memories (vectors omitted) |
| DELETE | `/api/memories/:id` | Delete one memory |
| POST | `/api/seed` | Insert 6 demo memories about a fictional indie developer |
| POST | `/api/chat` | `{question}` → `{answer, sources, model}` |

Try it: load the demo memories, then ask
"What is the user's main Chrome extension and how many users does it have?"

## Local development

The Worker is dependency-free (`worker.js`). Deploy with `deploy.py`, which
uses the Cloudflare API to create the KV namespace, upload the script with its
bindings (KV `MEMORIES` + secret `NEBIUS_API_KEY`), and enable the workers.dev
subdomain. To run it under your own accounts you need a Cloudflare account and
a Nebius Token Factory API key set as the `NEBIUS_API_KEY` Worker secret.

## License

MIT
