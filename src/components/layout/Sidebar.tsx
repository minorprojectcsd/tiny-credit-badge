import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calendar, Video, Users, Settings, LogOut, Shield,
  Sun, Moon, Menu, MessageSquareText, ScanFace, AudioLines, FileText,
  Bell, UserCircle, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import mindcareLogo from '@/assets/mindcare-brain.png';

const patientNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/patient/dashboard' },
  { icon: Calendar, label: 'My Appointments', href: '/patient/appointments' },
  { icon: Video, label: 'Book Appointment', href: '/patient/book-appointment' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: UserCircle, label: 'My Profile', href: '/profile' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

const doctorNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/doctor/dashboard' },
  { icon: Users, label: 'Appointments', href: '/doctor/appointments' },
  { icon: AudioLines, label: 'Voice Analysis', href: '/analysis/voice' },
  { icon: MessageSquareText, label: 'Chat Analysis', href: '/analysis/chat' },
  { icon: ScanFace, label: 'Emotion Analysis', href: '/analysis/emotion' },
  { icon: FileText, label: 'Session Summary', href: '/analysis/summary' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: UserCircle, label: 'My Profile', href: '/profile' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
  { icon: Users, label: 'Users', href: '/admin/dashboard' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: UserCircle, label: 'My Profile', href: '/profile' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const navItems =
    user.role === 'ADMIN' ? adminNavItems
    : user.role === 'DOCTOR' ? doctorNavItems
    : patientNavItems;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <img src={mindcareLogo} alt="MindCare Logo" className="h-9 w-9 rounded-lg object-contain" />
        <div>
          <span className="font-orbitron font-semibold text-sidebar-foreground">mindcareX</span>
          <p className="text-xs text-muted-foreground">Mental Health Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href + item.label}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
            <span className="text-sm font-medium text-primary">
              {user.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase()}</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive" onClick={() => { onNavigate?.(); logout(); }}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <img src={mindcareLogo} alt="MindCare Logo" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-orbitron font-semibold text-foreground">mindcareX</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border bg-sidebar md:block">
        <SidebarContent />
      </aside>
    </>
  );
}
