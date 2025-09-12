import { Link } from 'react-router-dom'
import { BookOpen, Users, BarChart3 } from 'lucide-react'

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gb-navy to-gb-navy/90">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <div className="mb-8">
            <img 
              src="/gbname.png" 
              alt="Gustav Barkhuysen Attorneys" 
              className="h-16 mx-auto mb-4"
            />
          </div>
          <h1 className="text-5xl font-bold text-gb-gold mb-6 font-serif">
            Training Quiz Platform
          </h1>
          <p className="text-xl text-gb-gold/80 mb-12">
            Create engaging post-training quizzes with real-time results and fun metrics
          </p>
          
          <div className="max-w-md mx-auto">
            <div className="bg-white/95 rounded-lg p-8 shadow-lg hover:shadow-xl transition-shadow border border-gb-gold/20">
              <Users className="w-12 h-12 text-gb-gold mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-4 text-gb-navy font-serif">For Trainers</h2>
              <p className="text-gb-navy/70 mb-6">
                Create and manage quizzes, track participant progress, and view detailed analytics
              </p>
              <Link 
                to="/admin" 
                className="bg-gb-gold text-gb-navy px-6 py-3 rounded-lg hover:bg-gb-gold-light transition-colors inline-block font-medium"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>
          
          <div className="mt-16">
            <div className="bg-white/95 rounded-lg p-8 shadow-lg max-w-2xl mx-auto border border-gb-gold/20">
              <BarChart3 className="w-12 h-12 text-gb-gold mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-4 text-gb-navy font-serif">Fun Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-gb-gold/10 p-3 rounded text-gb-navy font-medium">Speed Demon</div>
                <div className="bg-gb-gold/20 p-3 rounded text-gb-navy font-medium">Perfectionist</div>
                <div className="bg-gb-gold/15 p-3 rounded text-gb-navy font-medium">Lightning Round</div>
                <div className="bg-gb-gold/25 p-3 rounded text-gb-navy font-medium">Streak Master</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home