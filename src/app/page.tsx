import Link from 'next/link'
import { Users, Bell, Sparkles, ArrowRight, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const features = [
  {
    icon: Users,
    title: 'Import your network',
    description: 'Upload your LinkedIn Connections CSV to bulk-import your professional contacts in seconds.',
  },
  {
    icon: Bell,
    title: 'Never go cold',
    description: 'Color-coded staleness badges surface exactly who you haven\'t spoken to in 30, 60, or 90+ days.',
  },
  {
    icon: Sparkles,
    title: 'AI follow-up drafts',
    description: 'One click generates a personalized, context-aware follow-up message using your interaction history.',
  },
]

const steps = [
  'Sign in with Google',
  'Import your LinkedIn connections or add contacts manually',
  'Log interactions as you meet, email, or call people',
  'Get a weekly digest of who to reach out to',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Networking CRM</span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-xs font-medium text-blue-700 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          AI-powered networking automation
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Never let a relationship<br />go cold again.
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Import your LinkedIn network, track every interaction, and get AI-written follow-up messages — with a weekly digest of exactly who to reach out to.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#how-it-works" className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            How it works →
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">Everything you need to stay connected</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How it works</h2>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-gray-700 pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to build better relationships?</h2>
          <p className="text-blue-200 mb-8">Free to use. No credit card required.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Get started — it&apos;s free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <span>Networking CRM</span>
          <a href="https://maxwexley.com" className="hover:text-gray-700 transition-colors">Built by Max Wexley</a>
        </div>
      </footer>
    </div>
  )
}