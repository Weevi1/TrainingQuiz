# TrainingQuiz Project

## Project Overview
Training Quiz application for post-training engagement. Allows trainers to create quizzes and participants to join via QR code with real-time results and fun metrics.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Hosting**: Vercel (frontend) - deployed, Netlify limits too low
- **Libraries**: React Router, QR Code generation, Lucide React icons

## Commands
```bash
# Development
cd frontend && npm run dev

# Build
cd frontend && npm run build

# Install dependencies
cd frontend && npm install

# Database setup
# Run database-schema.sql in Supabase SQL editor
```

## Project Structure
```
TrainingQuiz/
├── database-schema.sql      # Supabase database schema
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/          # Route components
│   │   │   ├── Home.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── QuizBuilder.jsx
│   │   │   ├── QuizSession.jsx
│   │   │   ├── QuizTaking.jsx
│   │   │   └── Results.jsx
│   │   ├── lib/
│   │   │   └── supabase.js # Supabase client
│   │   └── App.jsx
│   └── .env.example        # Environment variables template
└── CLAUDE.md
```

## Setup Instructions
1. Create Supabase project at https://supabase.com
2. Run the SQL in `database-schema.sql` in Supabase SQL editor
3. Copy `frontend/.env.example` to `frontend/.env` and add your Supabase credentials
4. Run `cd frontend && npm install && npm run dev`

## Features Implemented
- ✅ Home page with trainer/participant portals
- ✅ Admin dashboard with stats and quick actions
- ✅ Quiz builder with question management
- ✅ Live quiz session management with QR codes
- ✅ Interactive quiz-taking interface
- ✅ Results page with leaderboards and awards
- ✅ Fun metrics: Speed Demon, Perfectionist, Streak Master, Photo Finish
- ✅ Real-time participant tracking
- ✅ Responsive design with Tailwind CSS
- ✅ Supabase backend integration (all components connected)
- ✅ Deployed to Vercel

## Next Steps

### Immediate Setup (Required to run the app)
1. **Create Supabase Project**
   - Go to https://supabase.com and create a free account
   - Create a new project
   - Wait for it to initialize (takes ~2 minutes)

2. **Setup Database**
   - In Supabase dashboard, go to SQL Editor
   - Copy and paste the entire contents of `database-schema.sql`
   - Click "Run" to create all tables and policies

3. **Configure Environment Variables**
   ```bash
   cd frontend
   cp .env.example .env
   ```
   - In Supabase dashboard, go to Settings → API
   - Copy "Project URL" and "anon public" key to your `.env` file

4. **Start Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

### Future Development Tasks
- [ ] Implement real-time subscriptions for live updates
- [ ] Add trainer authentication system
- [ ] Implement session code generation logic
- [ ] Add more award types (Close Call, Lightning Round, etc.)
- [ ] Add email notifications for results
- [ ] Add mobile PWA support
- [ ] Performance optimizations
- [ ] Enhanced error handling