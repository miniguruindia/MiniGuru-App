'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, LogOut, Video } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/login')
  }

  const navItems = [
    { href: '/', label: 'Dashboard', icon: null },
    { href: '/users', label: 'Users', icon: null },
    { href: '/projects', label: 'Projects', icon: null },
    { href: '/videos', label: 'Video Approvals', icon: Video }, // 🎬 NEW
    { href: '/orders', label: 'Orders', icon: null },
    { href: '/products', label: 'Products', icon: null },
    { href: '/categories', label: 'Categories', icon: null },
  ]

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <li key={item.href}>
            <Link 
              href={item.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {item.label}
            </Link>
          </li>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">MiniGuru Admin Panel</h1>
            
            {/* Desktop Nav */}
            <nav className="hidden md:block">
              <ul className="flex space-x-2">
                <NavLinks />
              </ul>
            </nav>

            {/* Desktop Logout */}
            <div className="hidden md:flex items-center gap-4">
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                <nav>
                  <ul className="flex flex-col space-y-2 mt-6">
                    <NavLinks />
                  </ul>
                  <div className="mt-6 pt-6 border-t">
                    <Button 
                      onClick={handleLogout}
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-6">
        {children}
      </main>

      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-4 shadow-lg">
        <div className="container mx-auto text-center">
          <p className="text-sm">&copy; {new Date().getFullYear()} MiniGuru. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}