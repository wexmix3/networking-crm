'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Users, LayoutDashboard, Upload, Settings, LogOut, BarChart2, Menu, X } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const links = [
  { href: '/dashboard', label: 'Contacts', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function isLinkActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/contacts')
  return pathname === href || pathname.startsWith(href + '/')
}

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [email, setEmail] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
  }, [])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = email ? email[0].toUpperCase() : '?'

  const navLinks = (
    <ul className="flex-1 px-3 py-4 space-y-0.5">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = isLinkActive(href, pathname)
        return (
          <li key={href}>
            <Link
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
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
  )

  const userFooter = (
    <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ background: '#6366f1' }}
        >
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
  )

  const logo = (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6366f1' }}>
        <Users className="w-4 h-4 text-white" />
      </div>
      <span className="font-semibold text-white text-sm tracking-tight">Networking CRM</span>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <nav className="hidden md:flex w-56 min-h-screen flex-col" style={{ background: '#0f172a' }}>
        {logo}
        {navLinks}
        {userFooter}
      </nav>

      {/* Mobile top bar — visible on mobile only */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 border-b border-white/10"
        style={{ background: '#0f172a' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#6366f1' }}>
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">Networking CRM</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Drawer panel */}
          <nav
            className="relative w-64 min-h-screen flex flex-col"
            style={{ background: '#0f172a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6366f1' }}>
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-white text-sm tracking-tight">Networking CRM</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navLinks}
            {userFooter}
          </nav>
        </div>
      )}
    </>
  )
}
