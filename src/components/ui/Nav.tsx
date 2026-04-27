'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Users, LayoutDashboard, Upload, Settings, LogOut } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col py-6 px-4">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 text-sm">Networking CRM</span>
      </div>

      <ul className="flex-1 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </nav>
  )
}