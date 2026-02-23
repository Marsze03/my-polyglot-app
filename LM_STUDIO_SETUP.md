# 🤖 LM Studio Setup Guide for Local AI Dictionary Lookup

This guide will help you set up LM Studio to use a **free, private, local AI** to process dictionary lookups from Cambridge Dictionary.

**🔍 How the System Works:**
1. App scrapes real word data from Cambridge Dictionary website
2. LM Studio AI processes and structures the scraped data
3. You get accurate, well-formatted vocabulary entries

**Why this is awesome:**
- Real dictionary data from Cambridge
- Local AI processing (no cloud costs)
- Privacy-focused (AI processing on your PC)
- Accurate CEFR levels and definitions

## 📥 Step 1: Download and Install LM Studio

1. Go to [https://lmstudio.ai/](https://lmstudio.ai/)
2. Download LM Studio for Windows
3. Install and launch the application

## 🔽 Step 2: Download a Recommended Model

For vocabulary dictionary lookups, you need a model that's good at following instructions and providing structured data. Here are recommended models:

### Best Options (Sorted by Size):

**Small & Fast (3-8GB RAM):**
- `Llama 3.2 3B Instruct` - Fast, accurate, great for dictionary tasks
- `Phi-3 Mini 3.8B Instruct` - Microsoft's efficient model
- `Qwen 2.5 3B Instruct` - Excellent for language tasks

**Medium (8-16GB RAM):**
- `Llama 3.1 8B Instruct` - Very reliable, balanced
- `Gemma 2 9B Instruct` - Google's strong performer

**Large (16GB+ RAM):**
- `Llama 3.1 70B Instruct` - Best quality (requires powerful PC)

### How to Download:

1. In LM Studio, click the **🔍 Search** icon on the left
2. Search for the model name (e.g., "Llama 3.2 3B Instruct")
3. Look for quantized versions:
   - **Q4_K_M** - Good balance of quality and size (recommended)
   - **Q5_K_M** - Higher quality, larger size
   - **Q8_0** - Best quality, largest size
4. Click **Download** and wait for it to complete

## 🚀 Step 3: Start the Local Server

1. Click the **↔️ Local Server** icon on the left sidebar
2. In the "Select a model to load" dropdown, choose your downloaded model
3. Click **Start Server**
4. You should see: `Server running at http://localhost:1234`

**Important Server Settings:**
- **Port:** 1234 (default, don't change unless needed)
- **CORS:** Enable if you have issues (usually not needed)
- **Context Length:** 2048 is fine for dictionary lookups
- **Temperature:** 0.3 (will be overridden by app)

## ⚙️ Step 4: Configure Your App

1. Open your `.env.local` file in the project root
2. Add or update these lines:

```env
# Use LM Studio instead of OpenAI
USE_LM_STUDIO=true
LM_STUDIO_URL=http://localhost:1234/v1/chat/completions
LM_STUDIO_MODEL=local-model
```

3. **Remove or comment out** the OpenAI API key (you don't need it):
```env
# OPENAI_API_KEY=sk-... (not needed for LM Studio)
```

## ✅ Step 5: Test It Out

1. Make sure LM Studio server is running (you should see it in LM Studio)
2. Restart your Next.js app:
   ```bash
   npm run dev
   ```
3. Open the app in your browser
4. Click on any word or add a new one
5. Click the **"Fetch Info"** button
6. Watch LM Studio's server logs - you should see the request come in!

## 🎯 Expected Results

When you click "Fetch Info" on a word like "ephemeral", the system:

1. **Scrapes Cambridge Dictionary** for "ephemeral"
2. **Extracts:** definition, CEFR level, part of speech, examples
3. **AI processes** the scraped data into clean JSON format
4. **Returns:**

```json
{
  "part_of_speech": "adjective",
  "cefr_level": "C2",
  "meaning_primary": "lasting for a very short time",
  "usage_tips": "The beauty of the sunset was ephemeral, fading within minutes."
}
```

**This is REAL data from Cambridge Dictionary**, not AI hallucination!

## 🔧 Troubleshooting

### Problem: "Failed to fetch dictionary data from LM Studio"

**Solutions:**
1. Check if LM Studio server is running (look for green status)
2. Verify the port is 1234 in both LM Studio and your `.env.local`
3. Make sure a model is loaded in LM Studio
4. Try restarting the LM Studio server

### Problem: AI returns invalid JSON or gibberish

**Solutions:**
1. Use a better model (try Llama 3.2 3B Instruct or higher)
2. In LM Studio, try these settings:
   - Temperature: 0.1-0.3 (lower = more consistent)
   - Max Tokens: 500+
3. Reload the model in LM Studio

### Problem: Very slow responses

**Solutions:**
1. Use a smaller quantized model (Q4_K_M instead of Q8_0)
2. Reduce context length in LM Studio to 2048
3. Close other heavy applications
4. Consider GPU acceleration if you have a compatible GPU

### Problem: Model downloads are slow

**Solutions:**
1. Use a wired internet connection
2. Download during off-peak hours
3. Try a smaller model first to test

## 💡 Tips for Best Results

1. **Keep LM Studio Running:** The server must be running whenever you want to use the dictionary feature
2. **Model Selection:** Smaller models (3-8B) are usually fast enough for dictionary tasks
3. **RAM Usage:** Monitor your system RAM - leave at least 2-4GB free
4. **Consistent Model:** Once you find a model that works well, stick with it
5. **Backup Option:** Keep your OpenAI API key configured so you can switch back by setting `USE_LM_STUDIO=false`

## 🆚 LM Studio vs OpenAI Comparison

| Feature | LM Studio (Local) | OpenAI (Cloud) |
|---------|------------------|----------------|
| **Cost** | Free ✅ | Paid (~ $0.15 per 1M tokens) |
| **Privacy** | AI runs locally ✅ | Data sent to OpenAI |
| **Speed** | Depends on your PC | Very fast (~1-2 sec) |
| **Quality** | Good (model dependent) | Excellent ✅ |
| **Internet** | Required (for scraping) | Required |
| **Setup** | Medium effort | Easy (just API key) |
| **Data Source** | Real Cambridge Dictionary ✅ | Real Cambridge Dictionary ✅ |

## 📊 Recommended Model by Your PC Specs

- **8GB RAM:** Llama 3.2 3B Instruct Q4_K_M
- **16GB RAM:** Llama 3.1 8B Instruct Q4_K_M
- **32GB RAM:** Llama 3.1 8B Instruct Q5_K_M or Gemma 2 9B
- **64GB+ RAM:** Llama 3.1 70B Instruct Q4_K_M

## 🔄 Switching Between LM Studio and OpenAI

You can easily switch between local and cloud AI:

**Use LM Studio (Local):**
```env
USE_LM_STUDIO=true
```

**Use OpenAI (Cloud):**
```env
USE_LM_STUDIO=false
OPENAI_API_KEY=sk-your-key-here
```

Just change the setting and restart your dev server!

## ❓ Need Help?

- LM Studio Discord: [https://discord.gg/lmstudio](https://discord.gg/lmstudio)
- LM Studio Docs: Check in-app Help menu
- Reddit: r/LocalLLaMA for model recommendations

---

Happy vocabulary learning with your own private AI! 🎓✨
