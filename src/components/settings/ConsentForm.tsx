import { useState } from 'react';
import { Camera, Mic, Brain, MessageSquare, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ConsentSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function ConsentForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ConsentSettings>({
    cameraEnabled: true,
    micEnabled: true,
    chatAnalysisEnabled: true,
    emotionTrackingEnabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (key: keyof ConsentSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('consent_settings', JSON.stringify(settings));
      toast({
        title: 'Settings saved',
        description: 'Your privacy preferences have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const consentItems = [
    {
      key: 'cameraEnabled' as const,
      icon: Camera,
      title: 'Camera Access',
      description: 'Allow video during consultation sessions. Required for video calls.',
    },
    {
      key: 'micEnabled' as const,
      icon: Mic,
      title: 'Microphone Access',
      description: 'Allow audio during consultation sessions. Required for voice communication.',
    },
    {
      key: 'emotionTrackingEnabled' as const,
      icon: Brain,
      title: 'Emotion Analysis',
      description: 'Allow AI-powered emotion detection during sessions to help your doctor understand your emotional state.',
    },
    {
      key: 'chatAnalysisEnabled' as const,
      icon: MessageSquare,
      title: 'Chat Analysis',
      description: 'Allow analysis of chat messages to generate session summaries and insights.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Privacy & Consent Settings</CardTitle>
            <CardDescription>
              Control how your data is used during sessions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {consentItems.map((item) => (
          <div
            key={item.key}
            className="flex items-start justify-between gap-4 rounded-lg border p-4"
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <item.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium">{item.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
            <Switch
              checked={settings[item.key]}
              onCheckedChange={() => handleToggle(item.key)}
            />
          </div>
        ))}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
