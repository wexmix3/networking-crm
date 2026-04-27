import Nav from '@/components/ui/Nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}