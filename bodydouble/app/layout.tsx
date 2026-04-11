import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Body Double',
  description:
    'Warm, quiet body doubling for ADHD brains. Match with a real person, share your goal, and focus together for 25 minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
