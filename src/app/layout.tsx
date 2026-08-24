import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import RegisterSW from '@/components/pwa/register-sw'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NMDC Energy | Scaffolding',
  description: 'Internal scaffolding design and estimation tool — offline PWA for yard tablet',
  manifest: '/manifest.webmanifest',
  themeColor: '#16a34a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <RegisterSW />
        <div className="flex flex-col lg:flex-row h-dvh overflow-hidden" style={{ background: "var(--bg, var(--background))" }}>
          <Nav />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  )
}
