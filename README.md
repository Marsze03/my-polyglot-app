# Verba — The Art of Lexicon

A beautiful, minimalist vocabulary learning app for language enthusiasts and polyglots. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

![Verba App](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=flat-square&logo=tailwind-css)

## ✨ Features

### 📚 Vocabulary Management
- **Add words** in multiple languages (English & Japanese)
- **Smart duplicate detection** - prevents adding variations (plurals, verb forms)
- **Rich word details** - part of speech, CEFR levels, meanings, usage tips
- **Click-to-edit** - update any word by clicking on it
- **🤖 AI-powered dictionary lookup** - **ACTUALLY FETCHES** word data from online Cambridge Dictionary using:
  - **Web Scraping** - Real-time data extraction from Cambridge Dictionary website
  - **LM Studio (Local AI)** - Processes and structures the scraped data ⭐ Recommended
  - **OpenAI GPT-4** - Alternative AI processing (cloud-based, faster)
- **⚡ Batch Processing** - Fill info for ALL incomplete words at once!
  - Click "Fill All Info" button to process multiple words in one go
  - Scrapes Cambridge Dictionary for all words in a single batch
  - AI processes all results together (more efficient!)
  - Shows real-time progress during processing
  - Updates database automatically
- **Easy deletion** - hover over words to remove them

### 🔍 Search & Filter
- **Real-time search** across words, meanings, and parts of speech
- **Instant results** with match count display
- **Visual feedback** shows filtered vs total vocabulary

### 📊 Progress Tracking
- **Statistics dashboard** with beautiful gradient cards
- Track total words, completion percentage
- See your most common CEFR level
- Monitor words with complete definitions

### 🎯 Study Mode
- **Flashcard-style learning** with click-to-reveal
- **Self-assessment** - mark words you know
- **Smart quiz** - automatically uses words with meanings
- **Progress tracking** during study sessions
- **Final score** with percentage and retry option

### 🎨 User Experience
- **Light & Dark mode** with smooth transitions
- **Elegant typography** - Cormorant Garamond & Inter fonts
- **Responsive design** - works beautifully on all devices
- **Glassmorphism UI** - modern, frosted glass effects
- **Smooth animations** - fade-ins and transitions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project ([sign up free](https://supabase.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd my-polyglot-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Then update `.env.local` with your credentials:
   ```env
   # Supabase credentials (required)
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   
   # AI Dictionary Feature - Choose ONE option:
   
   # Option A: LM Studio (Local, Free, Private) - RECOMMENDED
   USE_LM_STUDIO=true
   LM_STUDIO_URL=http://localhost:1234/v1/chat/completions
   LM_STUDIO_MODEL=local-model
   
   # Option B: OpenAI (Cloud, Fast, Paid)
   # USE_LM_STUDIO=false
   # OPENAI_API_KEY=your-openai-api-key
   ```
   
   Get your Supabase credentials from [app.supabase.com](https://app.supabase.com)  
   For LM Studio setup, see **[LM_STUDIO_SETUP.md](LM_STUDIO_SETUP.md)**  
   For OpenAI, get API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

4. **Set up Supabase database**
   
   Create a table called `vocab_library` with the following schema:
   ```sql
   create table vocab_library (
     id bigint primary key generated always as identity,
     word text not null unique,
     part_of_speech text,
     cefr_level text,
     meaning_primary text,
     usage_tips text,
     lang_id integer,
     created_at timestamp with time zone default timezone('utc'::text, now())
   );
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) with App Router
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **AI:** [LM Studio](https://lmstudio.ai/) (Local) or [OpenAI GPT-4](https://openai.com/) (Cloud)
- **Fonts:** Cormorant Garamond, Inter, Geist
- **Theme:** [next-themes](https://github.com/pacocoursey/next-themes)

## 📖 Usage Guide

### Adding Words
1. Select your language (English/日本語)
2. Type the word in the input field
3. Click "Add" or press Enter
4. The app prevents duplicate words and variations

### Editing Words
1. Click on any word card
2. Update fields in the modal (word, meaning, level, etc.)
3. **Use the "Fetch Info" button** to auto-populate data from Cambridge Dictionary using AI
4. Click "Save Changes"

### AI Dictionary Lookup
The app **actually fetches real data from Cambridge Dictionary** and uses AI to structure it beautifully.

**🔍 How It Works:**
1. **Web Scraping** - Fetches the word page from Cambridge Dictionary website
2. **Data Extraction** - Parses HTML to extract definitions, CEFR levels, examples, pronunciation
3. **AI Processing** - Uses LM Studio or OpenAI to structure the data into a clean format
4. **Smart Fallback** - If AI fails, uses the scraped data directly

**🎯 Two AI Options Available:**

#### Option 1: LM Studio (Local AI) ⭐ Recommended
- ✅ **100% Free** - No API costs
- ✅ **Private** - Data processing happens on your computer
- ✅ **Real Dictionary Data** - Scrapes actual Cambridge Dictionary entries
- ⚡ **Fast** - Depends on your PC (usually 2-5 seconds)
- 🌐 **Requires Internet** - Only for scraping the dictionary website

**Quick Setup:**
1. Download [LM Studio](https://lmstudio.ai/)
2. Load a model (recommended: Llama 3.2 3B Instruct)
3. Start the local server
4. Set `USE_LM_STUDIO=true` in `.env.local`

📖 **[Full LM Studio Setup Guide](LM_STUDIO_SETUP.md)**

#### Option 2: OpenAI (Cloud AI)
- ⚡ **Very Fast** - 1-2 seconds response time
- 🎯 **High Quality** - Excellent accuracy
- 💰 **Paid** - ~$0.15 per 1 million tokens (very cheap)

**Setup:**
1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Add `OPENAI_API_KEY=sk-...` to `.env.local`
3. Set `USE_LM_STUDIO=false`

**How to Use:**

#### Single Word Lookup:
1. Click on a word to edit it (or add a new word)
2. Enter the word in the Word field
3. Click the **"Fetch Info"** button (blue button with download icon)
4. Wait a few seconds while the app:
   - Scrapes Cambridge Dictionary for the word
   - Extracts definitions, CEFR level, part of speech, examples
   - Uses AI to structure the data beautifully
5. Review the auto-filled data:
   - Part of speech (noun, verb, adjective, etc.)
   - CEFR level (A1-C2) - from Cambridge Dictionary
   - Primary meaning - exact definition from Cambridge
   - Example usage - from Cambridge Dictionary examples
6. Edit any field as needed
7. Click "Save Changes"

#### ⚡ Batch Processing (Recommended for Multiple Words):
**Perfect for filling info on many words at once!**

1. Add multiple words to your library (just the word, no details needed)
2. Look for the green **"Fill All Info (X)"** button at the top
   - X shows how many words need info
3. Click the button
4. Confirm the batch operation
5. Watch the progress:
   - App scrapes Cambridge Dictionary for ALL words
   - AI processes all results in one batch (super efficient!)
   - Each word is updated in the database automatically
   - Real-time counter shows progress (e.g., "15/20")
6. Get a summary when complete!

**Benefits of Batch Processing:**
- ✅ **Much faster** - One AI call for multiple words instead of many
- ✅ **More efficient** - LM Studio processes all at once
- ✅ **Automatic** - No need to click each word individually
- ✅ **Progress tracking** - See exactly what's happening

**Switch anytime** by changing `USE_LM_STUDIO` in your `.env.local` file!

### Studying
1. Click the "Study Mode" button at the top
2. Read each flashcard
3. Click to reveal the answer
4. Mark if you knew it or not
5. Review your score at the end

### Searching
1. Use the search bar to filter your vocabulary
2. Search works across words, meanings, and parts of speech
3. Click the × to clear search

## 🎨 Customization

### Changing Colors
Edit [app/globals.css](app/globals.css) to customize theme colors:
```css
.dark {
  --background: #020617;
  --foreground: #f8fafc;
}
```

### Adding Languages
Update the language selector in [app/page.tsx](app/page.tsx):
```tsx
const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ja' | 'fr'>('en')
```

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

MIT License - feel free to use this project for learning or personal use.

## 🙏 Acknowledgments

- Design inspiration from modern language learning apps
- Icons from Lucide/Feather Icons
- Fonts from Google Fonts

---

**Made with ❤️ for language learners worldwide**
