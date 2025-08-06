# AI Chat Assistant

A modern, mobile-first AI chat application built with Next.js, featuring text conversations and AI-powered image generation.

## ✨ Features

- **💬 AI Chat**: Powered by Google Gemini for intelligent conversations
- **🎨 Image Generation**: Create images using `/image` commands with multiple API fallbacks
- **📱 Mobile-First**: Optimized responsive design for all devices
- **🔐 Authentication**: Secure Auth0 integration
- **💾 Chat History**: Persistent conversations stored in Supabase
- **🌙 Dark Theme**: Beautiful dark UI with Bootstrap

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Auth0 account
- Supabase account
- Google Gemini API key

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up your environment variables in `.env.local`:

```env
# Auth0 Configuration
AUTH0_SECRET='your-auth0-secret'
AUTH0_DOMAIN='your-domain.auth0.com'
AUTH0_CLIENT_ID='your-client-id'
AUTH0_CLIENT_SECRET='your-client-secret'
APP_BASE_URL='http://localhost:3000'

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL='your-supabase-url'
NEXT_PUBLIC_SUPABASE_ANON_KEY='your-supabase-anon-key'

# Google Gemini API
GEMINI_API_KEY='your-gemini-api-key'

# Optional: Hugging Face (free image generation)
HUGGINGFACE_API_KEY='your-huggingface-token'

# Optional: OpenAI (paid image generation)
OPENAI_API_KEY='your-openai-api-key'
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Authentication**: Auth0
- **Database**: Supabase
- **AI**: Google Gemini API
- **Image Generation**: Multiple APIs (Hugging Face, Pollinations.ai, OpenAI)
- **API Layer**: tRPC for type-safe APIs
- **Styling**: Bootstrap 5 + Custom CSS
- **Icons**: Bootstrap Icons

## 📱 Usage

1. **Login**: Click the login button to authenticate with Auth0
2. **Chat**: Type messages to chat with the AI assistant
3. **Generate Images**: Use `/image [description]` to create AI-generated images
4. **View History**: All conversations are automatically saved

## 🎨 Image Generation

The app supports multiple image generation APIs:

1. **Hugging Face** (Free) - Primary option
2. **Pollinations.ai** (Free) - Fallback option
3. **OpenAI DALL-E** (Paid) - Premium fallback

## 🔧 Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📁 Project Structure

```
app/
├── components/          # React components
├── api/                # API routes
├── _trpc/              # tRPC client setup
├── globals.css         # Global styles
├── layout.tsx          # Root layout
└── page.tsx            # Home page

lib/                    # Utility libraries
├── auth0.ts           # Auth0 configuration
├── supabaseClient.ts  # Supabase client and helpers
└── geminiService.ts   # AI service integration

server/                # Backend logic
└── trpc/              # tRPC router and procedures
```

## 🚀 Deployment

The app is ready for deployment on Vercel, Netlify, or any Node.js hosting platform.

## 📝 License

This project is for educational purposes as part of an internship project.
