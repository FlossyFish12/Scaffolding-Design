import Link from 'next/link'

export function Nav() {
  return (
    <header style={{ backgroundColor: '#0d1b2a' }}>
      <div className="container mx-auto flex h-14 items-center gap-8 px-4">
        <Link href="/jobs" className="flex items-center gap-3 shrink-0">
          <NmdcLogo />
        </Link>
        <nav className="flex gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <Link href="/jobs" className="hover:text-white transition-colors">Jobs</Link>
          <Link href="/schedule" className="hover:text-white transition-colors">Schedule</Link>
          <Link href="/resources" className="hover:text-white transition-colors">Resources</Link>
        </nav>
      </div>
    </header>
  )
}

function NmdcLogo() {
  return (
    <svg width="96" height="30" viewBox="0 0 96 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="NMDC Energy">
      {/* N mark: left bar */}
      <rect x="0" y="2" width="5" height="18" rx="0.5" fill="white" />
      {/* N mark: green diagonal / triangle accent */}
      <polygon points="5,2 14,20 9,20 5,12" fill="#00b451" />
      {/* N mark: right bar */}
      <rect x="9" y="2" width="5" height="18" rx="0.5" fill="white" />
      {/* NMDC text */}
      <text x="20" y="15" fill="white" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="0.3">NMDC</text>
      {/* ENERGY text */}
      <text x="21" y="26" fill="#8aa2b8" fontSize="7" fontWeight="500" fontFamily="Inter, sans-serif" letterSpacing="2">ENERGY</text>
    </svg>
  )
}
