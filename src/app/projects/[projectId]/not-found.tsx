import Link from 'next/link'

export default function NotFound() {
  return (
    <main>
      <h1>Project not found</h1>
      <p>The project you&apos;re looking for doesn&apos;t exist or has been deleted.</p>
      <Link href="/">← Back to Dashboard</Link>
    </main>
  )
}
