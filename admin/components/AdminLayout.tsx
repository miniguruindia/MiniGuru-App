'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/users', label: 'Users' },
    { href: '/projects', label: 'Projects' },
    { href: '/orders', label: 'Orders' },
    { href: '/products', label: 'Products' },
    { href: '/categories', label: 'Categories' },
  ]

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <li key={item.href}>
          <Link 
            href={item.href}
            className={cn(
              "px-3 py-2 rounded-md text-sm font-medium",
              pathname === item.href
                ? "bg-gray-900 text-white"
                : "text-gray-300 hover:bg-gray-700 hover:text-white"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Miniguru Admin Panel</h1>
          <nav className="hidden md:block">
            <ul className="flex space-x-4">
              <NavLinks />
            </ul>
          </nav>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[240px] sm:w-[300px]">
              <nav>
                <ul className="flex flex-col space-y-2 mt-6">
                  <NavLinks />
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4">
        {children}
      </main>
      <footer className="bg-gray-800 text-white p-4">
        <div className="container mx-auto text-center">
          <p>Miniguru</p>
        </div>
      </footer>
    </div>
  )
}

