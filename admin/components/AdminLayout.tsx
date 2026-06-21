'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Users, 
  Video,
  MessageSquare,
  BarChart3,
  FileEdit,
  LogOut,
  Menu,
  X,
  Tag,
  School,
  Coins,
  Package,
  ShoppingBag
} from 'lucide-react'
import Image from 'next/image'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/login')
  }

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: LayoutDashboard,
      current: pathname === '/'
    },
    { 
      name: 'Users', 
      href: '/users', 
      icon: Users,
      current: pathname.startsWith('/users')
    },
    { 
      name: 'Video Approvals', 
      href: '/videos', 
      icon: Video,
      current: pathname.startsWith('/videos'),
      badge: 0
    },
    // ── Materials (shop) — replaces Products ──────────────
    { 
      name: 'Materials', 
      href: '/materials', 
      icon: Package,
      current: pathname.startsWith('/materials'),
      description: 'Set ASINs, prices, Goins'
    },
    // ── Project categories ─────────────────────────────────
    { 
      name: 'Categories', 
      href: '/categories', 
      icon: Tag,
      current: pathname.startsWith('/categories')
    },
    // ── Schools & T-LABs ─────────────────────────────────────
    { 
      name: 'Schools', 
      href: '/schools', 
      icon: School,
      current: pathname.startsWith('/schools')
    },
    // ── Goins ──────────────────────────────────────────────
    { 
      name: 'Goins', 
      href: '/goins', 
      icon: Coins,
      current: pathname.startsWith('/goins')
    },
    // ── Communication ──────────────────────────────────────
    { 
      name: 'Communication', 
      href: '/communication', 
      icon: MessageSquare,
      current: pathname.startsWith('/communication')
    },
    // ── Analytics ──────────────────────────────────────────
    { 
      name: 'Analytics', 
      href: '/analytics', 
      icon: BarChart3,
      current: pathname.startsWith('/analytics')
    },
    // ── CMS content ────────────────────────────────────────
    { 
      name: 'Content',
      href: '/content',
      icon: FileEdit,
      current: pathname.startsWith('/content')
    },
  ]

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <ul role="list" className="flex flex-1 flex-col gap-y-1">
      {navigation.map((item) => {
        const Icon = item.icon
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              onClick={onClick}
              className={cn(
                item.current
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50',
                'group flex gap-x-3 rounded-lg p-3 text-sm leading-6 font-medium transition-colors'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.name}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  const Logo = () => (
    <div className="flex items-center gap-3">
      <Image 
        src="/MGlogo.png" 
        alt="MiniGuru Logo" 
        width={40} 
        height={40}
        className="rounded-lg"
      />
      <div>
        <h1 className="font-bold text-gray-900">MiniGuru</h1>
        <p className="text-xs text-gray-500">Admin Panel</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200">
          <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-200">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col px-4">
            <NavItems />
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", sidebarOpen ? "block" : "hidden")}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white">
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <Logo />
            <button onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="px-4 py-4">
            <NavItems onClick={() => setSidebarOpen(false)} />
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="h-6 w-px bg-gray-200 lg:hidden" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => item.current)?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">Admin</p>
                  <p className="text-xs text-gray-500">admin@miniguru.in</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}