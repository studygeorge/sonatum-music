import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LiquidGlassNav from './components/LiquidGlassNav'
import Footer from './components/Footer'
import { CookieBanner } from './components/CookieBanner'
import { PlayerProvider } from './context/PlayerContext'
import { ToastProvider } from './components/Toast'

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Сонатум — Музыка в совершенстве',
  description: 'Сонатум — современный сервис духовной и классической музыки в безупречном качестве.',
  keywords: 'Сонатум, музыка, духовная музыка, православные песнопения, классика, стриминг',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Сонатум — Музыка в совершенстве',
    description: 'Стриминг русской духовной, народной, академической и современной музыки.',
    url: 'https://sonatum-music.ru',
    siteName: 'Сонатум',
    images: [{ url: '/og-image.png', width: 1080, height: 1080 }],
    locale: 'ru_RU',
    type: 'website',
  },
  themeColor: '#0039a6',
}

import Player from './components/Player'
import PlayerPaddingWrapper from './components/PlayerPaddingWrapper'
import GrainientBackground from './components/GrainientBackground'
import ScrollToTop from './components/ScrollToTop'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`} style={{ background: 'transparent' }}>
        <GrainientBackground />
        <ToastProvider><PlayerProvider>
          <ScrollToTop />
          <LiquidGlassNav />
          <PlayerPaddingWrapper>
            <div className="pb-8">
              {children}
            </div>
          </PlayerPaddingWrapper>
          <Footer />
          <Player />
          <CookieBanner />
        </PlayerProvider></ToastProvider>
      </body>
    </html>
  )
}