import type { SocialPlatforms, SocialContentType } from '@/types';

export interface PlatformDef {
  key: keyof SocialPlatforms;
  label: string;
  short: string;
  link: string;
  /** Background tint shown only on hover */
  hoverBg: string;
  /** Solid background when the platform is marked as posted */
  doneBg: string;
  /** Text / icon colour when posted */
  doneColor: string;
}

export const ALL_PLATFORMS: PlatformDef[] = [
  {
    key: 'instagram', label: 'Instagram', short: 'IG',
    link: 'https://www.instagram.com/',
    hoverBg:   'rgba(131, 58, 180, 0.15)',
    doneBg:    'rgba(131, 58, 180, 0.22)',
    doneColor: '#6B21A8',
  },
  {
    key: 'tiktok', label: 'TikTok', short: 'TT',
    link: 'https://www.tiktok.com/upload',
    hoverBg:   'rgba(20, 20, 20, 0.12)',
    doneBg:    'rgba(20, 20, 20, 0.20)',
    doneColor: '#111111',
  },
  {
    key: 'youtube', label: 'YouTube', short: 'YT',
    link: 'https://studio.youtube.com/',
    hoverBg:   'rgba(220, 38, 38, 0.12)',
    doneBg:    'rgba(220, 38, 38, 0.20)',
    doneColor: '#B91C1C',
  },
  {
    key: 'x', label: 'X', short: 'X',
    link: 'https://x.com/compose/post',
    hoverBg:   'rgba(20, 20, 20, 0.12)',
    doneBg:    'rgba(20, 20, 20, 0.20)',
    doneColor: '#111111',
  },
  {
    key: 'mastodon', label: 'Mastodon', short: 'MD',
    link: 'https://mastodon.social/',
    hoverBg:   'rgba(79, 70, 229, 0.15)',
    doneBg:    'rgba(79, 70, 229, 0.22)',
    doneColor: '#3730A3',
  },
  {
    key: 'pinterest', label: 'Pinterest', short: 'PT',
    link: 'https://www.pinterest.co.uk/pin-builder/',
    hoverBg:   'rgba(230, 0, 35, 0.12)',
    doneBg:    'rgba(230, 0, 35, 0.20)',
    doneColor: '#B91C1C',
  },
];

const PHOTO_KEYS:    (keyof SocialPlatforms)[] = ['instagram', 'x', 'mastodon', 'tiktok', 'pinterest'];
const VIDEO_KEYS:    (keyof SocialPlatforms)[] = ['instagram', 'tiktok', 'youtube'];
const CAROUSEL_KEYS: (keyof SocialPlatforms)[] = ['instagram', 'x', 'mastodon', 'tiktok', 'pinterest'];

export function platformsForType(type: SocialContentType): (keyof SocialPlatforms)[] {
  if (type === 'video') return VIDEO_KEYS;
  if (type === 'carousel') return CAROUSEL_KEYS;
  return PHOTO_KEYS;
}

export function visiblePlatforms(type: SocialContentType): PlatformDef[] {
  const keys = platformsForType(type);
  return ALL_PLATFORMS.filter(p => keys.includes(p.key));
}
