import Nav from '@/components/ui/Nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f1f5f9' }}>
      <Nav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}