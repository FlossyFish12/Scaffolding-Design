import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NMDC Scaffolding Design',
    short_name: 'Scaffolding',
    description: 'Internal scaffolding design — offline capable for yard tablet',
    start_url: '/jobs',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#16a34a',
    icons: [
      { src: '/favicon.ico', sizes: '256x256', type: 'image/x-icon' },
      { src: '/nmdc-logo.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
