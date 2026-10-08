export type Announcement = { id: string; title: string; content: string; startsAt: string; endsAt: string };
export type AdminAnnouncement = Announcement & { enabled: boolean; createdAt: string; status: 'scheduled' | 'active' | 'expired' | 'disabled' };
