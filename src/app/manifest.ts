import type { MetadataRoute } from 'next';

/**
 * Served at /manifest.webmanifest. This is what makes Add to Home Screen
 * produce a real app icon in standalone mode instead of a Safari bookmark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life Dashboard',
    short_name: 'Dashboard',
    description: 'Calendar, email, tasks and habits across every account, on one page.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#121211',
    theme_color: '#121211',
    categories: ['productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops icons to its own mask; maskable variants carry extra
      // padding so the glyph survives the crop.
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Today', url: '/' },
      { name: 'Calendar', url: '/calendar' },
      { name: 'Tasks', url: '/tasks' },
    ],
  };
}
