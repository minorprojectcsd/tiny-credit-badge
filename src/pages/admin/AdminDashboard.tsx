import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Settings, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const adminCards = [
    { title: 'Manage Users', icon: Users, href: '/admin/users', description: 'View and manage all users' },
    { title: 'Appointments', icon: Calendar, href: '/admin/appointments', description: 'View all appointments' },
    { title: 'Reports', icon: FileText, href: '/admin/reports', description: 'View system reports' },
    { title: 'Settings', icon: Settings, href: '/admin/settings', description: 'System configuration' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">System administration panel</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {adminCards.map((card) => (
            <Card
              key={card.title}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => navigate(card.href)}
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <card.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
