# Polyglot - Deployment Guide

## 🌐 Make Your App Accessible Online or on Intranet

### Option 1: Deploy to Internet (Public Access)

#### **Using Vercel (Recommended - Free)**

1. **Prepare Your Supabase Database**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to **Authentication** → **Settings**
   - Enable **Email** provider
   - Optional: Add email templates for confirmation emails
   
2. **Push Code to GitHub**
   ```bash
   cd my-polyglot-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/polyglot-app.git
   git push -u origin main
   ```

3. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     OPENAI_API_KEY=your_openai_or_lm_studio_key
     ```
   - Click "Deploy"

4. **Access Your App**
   - Your app will be live at: `https://your-app.vercel.app`
   - Share this link with anyone!

---

### Option 2: Intranet Access (Local Network Only)

#### **Run on Your Computer - Accessible by Other Devices on Same WiFi**

1. **Start the Development Server**
   ```bash
   cd my-polyglot-app
   npm run dev
   ```

2. **Find Your Local IP Address**
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" under your WiFi adapter (e.g., `192.168.1.100`)

3. **Access from Other Devices**
   - On your computer: `http://localhost:3000`
   - On other devices (same WiFi): `http://192.168.1.100:3000`
   - Replace `192.168.1.100` with your actual IP address

4. **Keep It Running**
   - The server must stay running on your computer
   - Other devices can access it as long as they're on the same network

---

### Option 3: Production Intranet Server

For a dedicated intranet server that runs 24/7:

1. **Build the Production App**
   ```bash
   cd my-polyglot-app
   npm run build
   npm run start
   ```

2. **Run as Background Service (Windows)**
   - Install [PM2](https://pm2.keymetrics.io/):
     ```bash
     npm install -g pm2
     ```
   - Start the app:
     ```bash
     pm2 start npm --name "polyglot" -- start
     pm2 save
     pm2 startup
     ```

3. **Access via Server IP**
   - Access from any device on your network at: `http://SERVER_IP:3000`

---

## 🔐 Authentication Setup

Your app now requires users to sign up/login before accessing vocabulary.

### Supabase Auth Configuration

1. **Enable Email Confirmation (Optional)**
   - Go to Supabase Dashboard → Authentication → Settings
   - Enable "Confirm email"
   - Users will receive confirmation emails

2. **Update Database Schema** (Important!)
   Run this SQL in Supabase SQL Editor to add user tracking:

   ```sql
   -- Add user_id column to vocab_library table
   ALTER TABLE vocab_library 
   ADD COLUMN user_id uuid REFERENCES auth.users(id);

   -- Create index for faster queries
   CREATE INDEX idx_vocab_user_id ON vocab_library(user_id);

   -- Enable Row Level Security (RLS)
   ALTER TABLE vocab_library ENABLE ROW LEVEL SECURITY;

   -- Policy: Users can only see their own words
   CREATE POLICY "Users can view own vocabs"
     ON vocab_library FOR SELECT
     USING (auth.uid() = user_id);

   -- Policy: Users can insert their own words
   CREATE POLICY "Users can insert own vocabs"
     ON vocab_library FOR INSERT
     WITH CHECK (auth.uid() = user_id);

   -- Policy: Users can update their own words
   CREATE POLICY "Users can update own vocabs"
     ON vocab_library FOR UPDATE
     USING (auth.uid() = user_id);

   -- Policy: Users can delete their own words
   CREATE POLICY "Users can delete own vocabs"
     ON vocab_library FOR DELETE
     USING (auth.uid() = user_id);
   ```

3. **Update Application Code**
   Modify `/app/page.tsx` to include `user_id` in all database operations:

   **In `fetchWords` function:**
   ```typescript
   const { data, error: fetchError } = await supabase
     .from('vocab_library')
     .select('*')
     .eq('user_id', user?.id) // Add this line
     .order('id', { ascending: false })
   ```

   **In `handleAddWord` function:**
   ```typescript
   const { data, error: insertError } = await supabase
     .from('vocab_library')
     .insert([{ 
       word: inputValue.trim(), 
       lang_id: selectedLanguage === 'en' ? 1 : 2,
       user_id: user?.id // Add this line
     }])
   ```

---

## 📴 Offline Functionality

The app now works offline with these features:

### What Works Offline:
- ✅ View all your vocabulary words
- ✅ Add new words (saved locally)
- ✅ Search through your vocab
- ✅ Practice with quizzes
- ✅ Edit existing words

### What Requires Internet:
- ❌ Dictionary lookup (AI-powered definitions)
- ❌ PDF import
- ❌ Batch dictionary fetch
- ❌ Syncing with cloud database

### How Offline Sync Works:
1. When offline, new words are saved to browser storage
2. When back online, words automatically sync to Supabase
3. You'll see an "Offline" indicator when disconnected

---

## 🎨 Features Overview

### For Visitors (Landing Page)
- Beautiful landing page explaining the app
- Sign up / Sign in buttons
- Works on all devices

### For Logged-In Users
- ✨ Add vocabulary words
- 🤖 AI-powered dictionary lookup (Cambridge + Oxford)
- 📖 Import words from PDF documents
- 🎯 4 quiz modes: Flashcards, Multiple Choice, Typing, Meaning Test
- 📊 Progress statistics
- 🔍 Search functionality
- 🌙 Dark mode
- 📴 Offline support with auto-sync
- 🔐 Private vocabulary (each user sees only their words)

---

## 🚨 Troubleshooting

### Issue: Can't access from other devices
- **Solution**: Make sure your firewall allows connections on port 3000
  ```powershell
  # Windows: Allow port 3000
  netsh advfirewall firewall add rule name="Next.js Dev" dir=in action=allow protocol=TCP localport=3000
  ```

### Issue: Users can see each other's vocabulary
- **Solution**: Run the SQL commands above to enable Row Level Security

### Issue: Offline mode not working
- **Solution**: Service worker needs HTTPS in production. Use Vercel for deployment.

### Issue: Email confirmations not sending
- **Solution**: Check Supabase → Authentication → Email Templates
  Set up SMTP or use Supabase's built-in email service

---

## 📧 Support

Need help? Check:
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
- Vercel docs: https://vercel.com/docs

---

**🎉 Your Polyglot app is ready to help users master languages!**
