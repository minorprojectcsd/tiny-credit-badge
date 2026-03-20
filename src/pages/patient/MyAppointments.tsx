import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, ArrowLeft, Video, XCircle, Mail, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appointmentService, PatientAppointment } from '@/services/appointmentService';
import { sessionService } from '@/services/sessionService';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function MyAppointments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const joinSessionMutation = useMutation({
    mutationFn: (appointmentId: string) => sessionService.joinSession(appointmentId),
    onSuccess: (data) => {
      navigate(`/video/${data.sessionId}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Cannot join session',
        description: error?.response?.data?.message || 'Session may not be started yet. Please wait for the doctor.',
        variant: 'destructive',
      });
    },
  });

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: appointmentService.getMyAppointments,
    enabled: user?.role === 'PATIENT',
    refetchInterval: 10000,
    retry: (failureCount, err: any) => (err?.response?.status === 403 ? false : failureCount < 2),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentService.cancelAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      toast({ title: 'Appointment Cancelled', description: 'Your appointment has been cancelled.' });
    },
    onError: () => {
      toast({ title: 'Failed', description: 'Could not cancel appointment.', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if ((error as any)?.response?.status === 403) {
      toast({
        title: 'Access denied',
        description: 'Your session role does not match this page. Please sign in again.',
        variant: 'destructive',
      });
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      localStorage.removeItem('mindcarex_auth_user');
      navigate('/login', { replace: true });
    }
  }, [error, navigate, toast]);

  const scheduled = appointments?.filter(a => ['BOOKED', 'SCHEDULED'].includes(a.status)) || [];
  const inProgress = appointments?.filter(a => a.status === 'IN_PROGRESS') || [];
  const active = [...inProgress, ...scheduled];
  const completed = appointments?.filter(a => a.status === 'COMPLETED') || [];
  const cancelled = appointments?.filter(a => a.status === 'CANCELLED') || [];

  const AppointmentCard = ({ appointment }: { appointment: PatientAppointment }) => {
    const isLive = appointment.status === 'IN_PROGRESS';
    const isBooked = ['BOOKED', 'SCHEDULED'].includes(appointment.status);

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:p-4">
        {/* Info row */}
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base truncate">Dr. {appointment.doctor?.name || 'Doctor'}</p>
          {appointment.doctor?.specialization && (
            <p className="text-xs text-muted-foreground">{appointment.doctor.specialization}</p>
          )}
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {format(new Date(appointment.startTime), 'EEE, MMM d, yyyy · h:mm a')}
            {appointment.endTime && (
              <> — {format(new Date(appointment.endTime), 'h:mm a')}</>
            )}
          </p>
        </div>

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              isLive ? 'default' :
              isBooked ? 'secondary' :
              appointment.status === 'COMPLETED' ? 'outline' :
              'destructive'
            }
            className="text-xs"
          >
            {isLive ? '🟢 Live' : appointment.status}
          </Badge>
          {(isBooked || appointment.status === 'COMPLETED') && (
            <span title="Email confirmation sent">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          {isLive && appointment.sessionId && (
            <div className="flex gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <Button size="sm" className="flex-1 sm:flex-initial text-xs" onClick={() => navigate(`/video/${appointment.sessionId}`)}>
                <Video className="mr-1 h-3 w-3" />
                Video
              </Button>
              <Button size="sm" variant="outline" className="flex-1 sm:flex-initial text-xs" onClick={() => navigate(`/chat-session/${appointment.sessionId}`)}>
                <MessageSquare className="mr-1 h-3 w-3" />
                Chat
              </Button>
            </div>
          )}
          {isLive && !appointment.sessionId && (
            <span className="text-xs text-muted-foreground">Session starting…</span>
          )}
          {isBooked && (
            <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <span className="text-xs text-muted-foreground flex-1">Waiting for doctor</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:mx-auto sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your appointment with Dr. {appointment.doctor?.name}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                    <AlertDialogCancel className="w-full sm:w-auto">Keep</AlertDialogCancel>
                    <AlertDialogAction
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => cancelMutation.mutate(appointment.id)}
                    >
                      Cancel Appointment
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout requireRole="PATIENT">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/patient/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold">My Appointments</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">View and manage your appointments</p>
            </div>
          </div>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => navigate('/patient/book-appointment')}>
            <Calendar className="mr-2 h-4 w-4" />
            Book New
          </Button>
        </div>

        <Tabs defaultValue="active">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="active" className="text-xs sm:text-sm">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm">Done ({completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs sm:text-sm">Cancelled ({cancelled.length})</TabsTrigger>
          </TabsList>

          {(['active', 'completed', 'cancelled'] as const).map((tab) => {
            const list = tab === 'active' ? active : tab === 'completed' ? completed : cancelled;
            return (
              <TabsContent key={tab} value={tab} className="mt-3 sm:mt-4">
                <Card>
                  <CardContent className="p-3 sm:pt-6">
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : list.length === 0 ? (
                      <div className="py-8 text-center">
                        <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
                        <p className="mt-3 text-sm text-muted-foreground">No {tab} appointments</p>
                        {tab === 'active' && (
                          <Button size="sm" className="mt-3" onClick={() => navigate('/patient/book-appointment')}>
                            Book an Appointment
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {list.map(apt => (
                          <AppointmentCard key={apt.id} appointment={apt} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
