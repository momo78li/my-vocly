import './globals.css'

export const metadata = {
  title: 'Vocly - Master your vocabulary',
  description: 'Learn vocabulary with spaced repetition',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
