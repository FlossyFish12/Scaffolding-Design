import Link from 'next/link'

export function Nav() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center gap-6 px-4">
        <Link href="/jobs" className="font-semibold text-sm">
          Scaffolding Platform
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/jobs" className="hover:text-foreground transition-colors">Jobs</Link>
          <Link href="/schedule" className="hover:text-foreground transition-colors">Schedule</Link>
          <Link href="/resources" className="hover:text-foreground transition-colors">Resources</Link>
        </nav>
      </div>
    </header>
  )
}
