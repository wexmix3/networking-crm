'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Users, LayoutDashboard, Upload, Settings, LogOut, BarChart2 } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const links = [
  { href: '/dashboard', label: 'Contacts', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = email ? email[0].toUpperCase() : '?'

  return (
    <nav className="w-56 min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6366f1' }}>
          <Users className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white text-sm tracking-tight">Networking CRM</span>
      </div>

      {/* Nav links */}
      <ul className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const isContacts = href === '/dashboard' && (pathname === '/dashboard' || pathname.startsWith('/contacts'))
          const isActive = isContacts || (href !== '/dashboard' && (pathname === href || pathname.startsWith(href + '/')))
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { background: 'rgba(99,102,241,0.25)' } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ background: '#6366f1' }}>
            {initials}
          </div>
          <span className="text-xs text-slate-400 truncate">{email}</span>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  )
}
