"use client"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const NAV_ITEMS = [
  { href: "/jobs",      label: "Jobs",      icon: <BriefcaseIcon /> },
  { href: "/schedule",  label: "Schedule",  icon: <CalendarIcon />  },
  { href: "/resources", label: "Resources", icon: <UsersIcon />     },
]

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== "/jobs" && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
        active ? "text-white" : "text-white/50 hover:text-white/85"
      }`}
      style={active ? { background: "var(--green)" } : undefined}
    >
      <span style={{ opacity: active ? 1 : 0.75 }}>{icon}</span>
      <span className="flex-1">{label}</span>
    </Link>
  )
}

export function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false) }
    if (mobileOpen) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  const navLinks = (
    <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
      {NAV_ITEMS.map((item) => <NavItem key={item.href} {...item} />)}
    </nav>
  )

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header
        className="lg:hidden flex items-center justify-between px-4 flex-shrink-0"
        style={{ background: "var(--navy)", borderBottom: "1px solid rgba(255,255,255,.07)", height: 56 }}
      >
        <Image src="/nmdc-logo.png" alt="NMDC Energy" width={100} height={30} style={{ height: 30, width: "auto" }} priority />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg"
          style={{ color: "rgba(255,255,255,.7)" }}
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="w-[280px] flex-shrink-0 flex flex-col overflow-hidden relative"
            style={{ background: "var(--navy)" }}
          >
            {/* Diagonal brand motif */}
            <div
              className="absolute bottom-[-60px] right-[-60px] w-[200px] h-[200px] rounded pointer-events-none"
              style={{ background: "var(--green)", opacity: 0.06, transform: "rotate(45deg)" }}
            />
            {/* Logo + close */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              <Image src="/nmdc-logo.png" alt="NMDC Energy" width={100} height={30} style={{ height: 30, width: "auto" }} priority />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg opacity-50 hover:opacity-100"
                style={{ color: "#fff" }}
                aria-label="Close menu"
              >
                <XIcon />
              </button>
            </div>
            {navLinks}
          </div>
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex lg:flex-col w-[220px] flex-shrink-0 overflow-hidden relative"
        style={{ background: "var(--navy)" }}
      >
        {/* Diagonal brand motif */}
        <div
          className="absolute bottom-[-60px] right-[-60px] w-[200px] h-[200px] rounded pointer-events-none"
          style={{ background: "var(--green)", opacity: 0.06, transform: "rotate(45deg)" }}
        />
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
          <Image src="/nmdc-logo.png" alt="NMDC Energy" width={120} height={36} style={{ height: 36, width: "auto" }} priority />
        </div>
        {navLinks}
      </aside>
    </>
  )
}

/* ── Icons ── */
function BriefcaseIcon() {
  return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v.01"/></svg>
}
function CalendarIcon() {
  return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function UsersIcon() {
  return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
}
function HamburgerIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
}
function XIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
}
