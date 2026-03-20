import api from '@/lib/api';
import type { NotificationLog, NotificationStats } from '@/types/notification';

const BASE = '/api/notifications';

export const emailNotificationService = {
  /** Get email history for current user */
  async getHistory(): Promise<NotificationLog[]> {
    const res = await api.get<NotificationLog[]>(`${BASE}/history`);
    return res.data;
  },

  /** Get email statistics (ADMIN only) */
  async getStatistics(): Promise<NotificationStats> {
    const res = await api.get<NotificationStats>(`${BASE}/statistics`);
    return res.data;
  },

  /** Resend a failed notification */
  async resendNotification(logId: string): Promise<{ status: string }> {
    const res = await api.post<{ status: string }>(`${BASE}/${logId}/resend`);
    return res.data;
  },

  /** Send a test email */
  async sendTestEmail(): Promise<{ status: string }> {
    const res = await api.post<{ status: string }>(`${BASE}/test`);
    return res.data;
  },
};

export default emailNotificationService;
