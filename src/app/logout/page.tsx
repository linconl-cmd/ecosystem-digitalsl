'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.signOut().finally(() => {
      router.push('/login')
      router.refresh()
    })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <p className="text-sm text-zinc-500">Saindo...</p>
    </div>
  )
}
