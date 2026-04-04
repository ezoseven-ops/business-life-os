import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Business Life OS',
    short_name: 'BLOS',
    description: 'Your centralized command center',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080d',
    theme_color: '#08080d',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
