'use client'

import { AdminLayout } from '@/components/AdminLayout'
import { Card } from "@/components/ui/card"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Video, Package, ArrowUpRight,
  RefreshCw, Coins, Megaphone, ShieldAlert,
  Lightbulb, HandCoins, AlertTriangle, Globe, TrendingUp, FolderOpen,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function authHeader() {
  const token = getCookie('auth_token') || ''
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

const DEFAULT_STATS = {
  total: { users: 0, projects: 0, orders: 0, products: 0 },
  new:   { users: 0, projects: 0, orders: 0 },
}

// A single failed endpoint should never take down the whole dashboard —
// each attention-item fetch is independently wrapped so one backend hiccup
// just shows 0 for that item instead of breaking the page.
async function safeCount(url: string, extract: (data: any) => number): Promise<number> {
  try {
    const res = await fetch(url, { headers: authHeader(), credentials: 'include' })
    if (!res.ok) return 0
    return extract(await res.json())
  } catch {
    return 0
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats,         setStats]         = useState(DEFAULT_STATS)
  const [materialCount, setMaterialCount] = useState(0)
  const [asinCount,     setAsinCount]     = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState('')

  // ── "Needs Your Attention" counts ──────────────────────────────────────
  const [pendingVideos,      setPendingVideos]      = useState(0)
  const [pendingCommunity,   setPendingCommunity]   = useState(0)
  const [pendingContact,     setPendingContact]     = useState(0)
  const [pendingSuggestions, setPendingSuggestions] = useState(0)
  const [pendingGoinTopUps,  setPendingGoinTopUps]  = useState(0)

  // ── Website traffic (Google Analytics GA4) ─────────────────────────────
  const [webAnalytics, setWebAnalytics] = useState<{
    configured: boolean
    last7Days?: { sessions: number; activeUsers: number; pageViews: number }
    last30Days?: { sessions: number; activeUsers: number; pageViews: number }
    topPages?: { path: string; views: number }[]
    error?: string
  }>({ configured: false })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = authHeader()
      const [statsRes, matsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`,   { headers, credentials: 'include' }),
        fetch(`${API_BASE}/materials`,      { headers, credentials: 'include' }),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats({
          total: { ...DEFAULT_STATS.total, ...(data?.total ?? {}) },
          new:   { ...DEFAULT_STATS.new,   ...(data?.new   ?? {}) },
        })
      } else {
        setError(`Stats error: ${statsRes.status}`)
      }

      if (matsRes.ok) {
        const mdata = await matsRes.json()
        const list  = Array.isArray(mdata) ? mdata : (mdata.materials ?? [])
        setMaterialCount(list.length)
        setAsinCount(list.filter((m: any) => m.amazonASIN).length)
      }

      // Attention counts — fetched independently and in parallel so a
      // single slow/broken endpoint doesn't block or break the rest.
      const [videos, happenings, challenges, contact, suggestions, topups] = await Promise.all([
        safeCount(`${API_BASE}/admin/projects/pending`, d => Array.isArray(d) ? d.length : (d.projects?.length ?? 0)),
        safeCount(`${API_BASE}/admin/happenings`, d => (d.happenings || []).filter((h: any) => h.status === 'PENDING').length),
        safeCount(`${API_BASE}/admin/challenges`, d => (d.challenges || []).filter((c: any) => c.status === 'PENDING').length),
        safeCount(`${API_BASE}/admin/contact-change-requests`, d => (d.requests || []).length),
        safeCount(`${API_BASE}/admin/product-suggestions?status=pending`, d => (d.suggestions || []).length),
        safeCount(`${API_BASE}/goins/admin/topup/pending`, d => (d.requests || []).length),
      ])
      setPendingVideos(videos)
      setPendingCommunity(happenings + challenges)
      setPendingContact(contact)
      setPendingSuggestions(suggestions)
      setPendingGoinTopUps(topups)

      // Independent fetch — a missing/misconfigured GA4 setup should never
      // break the rest of the dashboard, so this is wrapped separately.
      try {
        const gaRes = await fetch(`${API_BASE}/admin/analytics/website`, { headers, credentials: 'include' })
        if (gaRes.ok) setWebAnalytics(await gaRes.json())
      } catch { /* leave configured: false */ }
    } catch (e: any) {
      setError(`Connection failed: ${e?.message}`)
    } finally {
      setLoading(false)
      setLastRefreshed(new Date().toLocaleTimeString('en-IN'))
    }
  }

  useEffect(() => { load() }, [])

  const mainStats = [
    {
      title: 'Total Users',
      value: stats.total.users,
      sub: `+${stats.new.users} this week`,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      href: '/people'
    },
    {
      title: 'Projects / Videos',
      value: stats.total.projects,
      sub: `+${stats.new.projects} this week`,
      icon: Video,
      gradient: 'from-purple-500 to-pink-500',
      href: '/videos'
    },
    {
      title: 'Materials',
      value: materialCount,
      sub: `${asinCount} linked to Amazon`,
      icon: Package,
      gradient: 'from-orange-500 to-amber-500',
      href: '/materials'
    },
    {
      title: 'Goins Awarded',
      value: '—',
      sub: 'View in Goins page',
      icon: Coins,
      gradient: 'from-emerald-500 to-teal-500',
      href: '/goins'
    },
  ]

  const attentionItems = [
    {
      label: 'Videos awaiting approval', count: pendingVideos, icon: Video,
      href: '/videos', color: 'purple',
    },
    {
      label: 'Community submissions pending', count: pendingCommunity, icon: Megaphone,
      href: '/community', color: 'indigo',
    },
    {
      label: 'Contact change requests', count: pendingContact, icon: ShieldAlert,
      href: '/people?tab=contact', color: 'red',
    },
    {
      label: 'Material suggestions from users', count: pendingSuggestions, icon: Lightbulb,
      href: '/materials?tab=suggestions', color: 'amber',
    },
    {
      label: 'Goin top-up requests', count: pendingGoinTopUps, icon: HandCoins,
      href: '/goins?tab=requests', color: 'emerald',
    },
  ]
  const totalPending = attentionItems.reduce((sum, i) => sum + i.count, 0)

  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    purple:  { bg: 'bg-purple-50 border-purple-100 hover:bg-purple-100',   text: 'text-purple-900',  iconBg: 'text-purple-600' },
    indigo:  { bg: 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100',   text: 'text-indigo-900',  iconBg: 'text-indigo-600' },
    red:     { bg: 'bg-red-50 border-red-100 hover:bg-red-100',           text: 'text-red-900',     iconBg: 'text-red-600' },
    amber:   { bg: 'bg-amber-50 border-amber-100 hover:bg-amber-100',     text: 'text-amber-900',   iconBg: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100', text: 'text-emerald-900', iconBg: 'text-emerald-600' },
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            {error && <p className="text-sm text-red-600 mt-0.5">⚠️ {error}</p>}
            {lastRefreshed && <p className="text-xs text-gray-400 mt-0.5">Last refreshed {lastRefreshed}</p>}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {mainStats.map(stat => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}
                onClick={() => router.push(stat.href)}
                className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} bg-opacity-10`}>
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-300" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.title}</h3>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.sub}</p>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Amazon affiliate progress */}
        <Card className="p-6 border-0 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Amazon Affiliate Setup</h3>
              <p className="text-sm text-gray-500">
                {asinCount} of {materialCount} materials have Amazon ASINs linked
              </p>
            </div>
            <button onClick={() => router.push('/materials?tab=amazon')}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium">
              Add ASINs →
            </button>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-400 to-amber-500 h-3 rounded-full transition-all duration-500"
              style={{ width: materialCount > 0 ? `${Math.round((asinCount / materialCount) * 100)}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-xs text-gray-400">
              {materialCount > 0 ? Math.round((asinCount / materialCount) * 100) : 0}% complete
            </p>
            <p className="text-xs text-orange-600 font-medium">
              {materialCount - asinCount} materials still need ASINs
            </p>
          </div>
          {asinCount === 0 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700 font-medium">
                ⚠️ No ASINs set yet — "Buy All on Amazon" button won't appear in the shop until at least one ASIN is added.
                Go to Materials → Amazon Setup tab to add them.
              </p>
            </div>
          )}
        </Card>

        {/* Needs Your Attention — was previously paired with a "Quick
            Actions" card, but 3 of its 4 buttons were pure duplicates of
            items already here (Approve Videos = same as "Videos awaiting
            approval" below, Add ASINs = same as the Amazon Setup progress
            card's own button, Review Community Submissions = same as the
            community-pending row below). Removed that whole card; kept the
            one genuinely unique action (Send Announcement) as a small link
            here instead of losing it entirely. */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="p-6 border-0 shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> Needs Your Attention
                </h3>
                <p className="text-sm text-gray-500">
                  {totalPending === 0 ? 'All caught up! 🎉' : `${totalPending} item${totalPending === 1 ? '' : 's'} across the platform`}
                </p>
              </div>
              <button onClick={() => router.push('/communication')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Megaphone className="h-3.5 w-3.5" /> Send Announcement
              </button>
            </div>
            <div className="space-y-2">
              {attentionItems.map(item => {
                const Icon = item.icon
                const c = colorClasses[item.color]
                return (
                  <button key={item.label} onClick={() => router.push(item.href)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-lg border transition-colors ${c.bg}`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${c.iconBg}`} />
                      <span className={`text-sm font-medium ${c.text}`}>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${item.count > 0 ? c.text : 'text-gray-300'}`}>
                        {item.count}
                      </span>
                      <ArrowUpRight className={`h-3.5 w-3.5 ${item.count > 0 ? c.iconBg : 'text-gray-300'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* New This Week — merged in from the old separate Analytics tab,
            which was redundant with this page. Orders dropped — own-store
            is paused (Rule 26), it would only ever show 0. */}
        <Card className="p-6 border-0 shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New This Week</h3>
          <div className="space-y-3">
            {[
              { label: 'New Users', value: stats.new.users, total: stats.total.users, icon: Users, color: 'text-blue-500' },
              { label: 'New Projects', value: stats.new.projects, total: stats.total.projects, icon: FolderOpen, color: 'text-purple-500' },
            ].map((row) => {
              const Icon = row.icon
              const pct = row.total ? Math.round((row.value / row.total) * 100) : 0
              return (
                <div key={row.label} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-36">
                    <Icon className={`h-4 w-4 ${row.color}`} />
                    <span className="text-sm text-gray-700">{row.label}</span>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex items-center gap-2 w-20 text-right justify-end">
                    <span className="text-sm font-semibold text-gray-900">+{row.value}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Website Traffic — real Google Analytics (GA4) data once
            configured. Shows setup instructions instead of a fake chart
            until GA4_PROPERTY_ID + service account access are added. */}
        <Card className="p-6 border-0 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-semibold text-gray-900">Website Traffic</h3>
          </div>
          {webAnalytics.configured ? (
            webAnalytics.error ? (
              <p className="text-sm text-red-600">⚠️ {webAnalytics.error}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Visits (7d)', value: webAnalytics.last7Days?.sessions ?? 0 },
                    { label: 'Visitors (7d)', value: webAnalytics.last7Days?.activeUsers ?? 0 },
                    { label: 'Page views (7d)', value: webAnalytics.last7Days?.pageViews ?? 0 },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-3 bg-sky-50 rounded-lg">
                      <p className="text-2xl font-bold text-sky-900">{s.value.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-sky-600 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {webAnalytics.last30Days?.sessions ?? 0} visits in the last 30 days
                </p>
                {webAnalytics.topPages && webAnalytics.topPages.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">Top pages this week</p>
                    <div className="space-y-1">
                      {webAnalytics.topPages.map((p) => (
                        <div key={p.path} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate">{p.path}</span>
                          <span className="font-medium">{p.views}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-800 space-y-2">
              <p className="font-medium">Not connected yet</p>
              <p className="text-xs text-sky-700">
                1. Find your GA4 Property ID: analytics.google.com → Admin → Property Settings.<br />
                2. In GA4 → Admin → Property Access Management, add the Firebase service account's
                email (the "client_email" inside FIREBASE_SERVICE_ACCOUNT_JSON) as a <b>Viewer</b> — no
                new key needed, it reuses the same one already in Secret Manager.<br />
                3. Add <code className="bg-sky-100 px-1 rounded">GA4_PROPERTY_ID</code> as a Cloud Run
                env var and redeploy. This card will start showing real numbers automatically.
              </p>
            </div>
          )}
        </Card>

      </div>
    </AdminLayout>
  )
}
