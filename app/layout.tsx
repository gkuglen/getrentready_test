import type { Metadata } from 'next'
import { Inter, Caveat, Geist_Mono, Schibsted_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
});
const caveat = Caveat({ 
  subsets: ["latin"],
  variable: "--font-caveat"
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-schibsted",
});

export const metadata: Metadata = {
  title: 'GetRentReady — Find Your Market Rent',
  description: 'Enter a property address to instantly see estimated market rents for Studio, 1BR, 2BR, and 3BR units.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.variable} ${caveat.variable} ${geistMono.variable} ${schibsted.variable} font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
