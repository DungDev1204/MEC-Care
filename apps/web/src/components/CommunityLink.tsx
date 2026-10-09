import { useLiveResource } from '../lib/live-resource';

export function TelegramIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.8 3.5c.7-.3 1.3.2 1.1 1L18.5 20c-.2.9-.7 1.1-1.4.7l-5.2-3.8-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.3L18.5 5.8c.4-.4-.1-.6-.6-.3L5.9 13l-5.2-1.6c-.9-.3-.9-.9.2-1.3L20.8 3.5Z"/></svg>;
}

export function CommunityLink() {
  const resource = useLiveResource<{ telegramCommunityUrl: string }>('/api/community-settings', 30000);
  const url = resource.data?.telegramCommunityUrl;
  if (!url || resource.error) return null;
  return <a className="community-link" href={url} target="_blank" rel="noopener noreferrer" aria-label="Tham gia góp ý phát triển Clienté qua Telegram" title="Tham gia góp ý phát triển Clienté qua Telegram"><span className="community-icon"><TelegramIcon/></span><span>Tham gia góp ý phát triển Clienté</span></a>;
}
