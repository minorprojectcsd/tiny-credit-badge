import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, ArrowLeft, Video, XCircle, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { appointmentService, DoctorAppointment } from '@/services/appointmentService';
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

export default function DoctorAppointments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['doctor-appointments'],
    queryFn: appointmentService.getDoctorAppointments,
    refetchInterval: 10000,
  });

  const startSessionMutation = useMutation({
    mutationFn: (appointmentId: string) => sessionService.startSession(appointmentId),
    onSuccess: (data) => {
      navigate(`/video/${data.sessionId}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to start session',
        description: error?.response?.data?.message || 'Could not start the session.',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentService.cancelAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-appointments'] });
      toast({ title: 'Appointment Cancelled', description: 'The appointment has been cancelled.' });
    },
    onError: () => {
      toast({ title: 'Failed', description: 'Could not cancel appointment.', variant: 'destructive' });
    },
  });

  const scheduled = appointments?.filter(a => ['SCHEDULED', 'BOOKED'].includes(a.status)) || [];
  const inProgress = appointments?.filter(a => a.status === 'IN_PROGRESS') || [];
  const active = [...inProgress, ...scheduled];
  const completed = appointments?.filter(a => a.status === 'COMPLETED') || [];
  const cancelled = appointments?.filter(a => a.status === 'CANCELLED') || [];

  const AppointmentCard = ({ appointment }: { appointment: DoctorAppointment }) => {
    const isLive = appointment.status === 'IN_PROGRESS';
    const isBooked = ['BOOKED', 'SCHEDULED'].includes(appointment.status);

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:p-4">
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base truncate">{appointment.patient?.fullName || appointment.patient?.name || 'Patient'}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {format(new Date(appointment.startTime), 'EEE, MMM d, yyyy · h:mm a')}
            {appointment.endTime && (
              <> — {format(new Date(appointment.endTime), 'h:mm a')}</>
            )}
          </p>
        </div>
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
          {isLive && (
            <div className="flex gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <Button size="sm" className="flex-1 sm:flex-initial text-xs" onClick={() => navigate(`/video/${appointment.sessionId || appointment.id}`)}>
                <Video className="mr-1 h-3 w-3" />
                Resume
              </Button>
              <Button size="sm" variant="outline" className="flex-1 sm:flex-initial text-xs" onClick={() => navigate(`/chat-session/${appointment.sessionId || appointment.id}`)}>
                <MessageSquare className="mr-1 h-3 w-3" />
                Chat
              </Button>
            </div>
          )}
          {isBooked && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <Button
                size="sm"
                className="flex-1 sm:flex-initial text-xs"
                disabled={startSessionMutation.isPending}
                onClick={() => startSessionMutation.mutate(appointment.id)}
              >
                <Video className="mr-1 h-3 w-3" />
                Start Session
              </Button>
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
                      This will cancel the appointment with {appointment.patient?.fullName || appointment.patient?.name}. This action cannot be undone.
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
    <DashboardLayout requireRole="DOCTOR">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/doctor/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold">Appointments</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage your patient appointments</p>
          </div>
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
