'use client';

import { SOCIAL_QUICK_LINKS } from '@/lib/socialQuickLinks';

export default function SocialLaunchBar() {
  return (
    <div className="mb-6 grid grid-cols-4 gap-3 sm:grid-cols-7">
      {SOCIAL_QUICK_LINKS.map(platform => (
        <a
          key={platform.key}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${platform.label} to upload`}
          className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <svg
            viewBox={platform.viewBox}
            className="h-6 w-6 transition-colors"
            style={{ fill: platform.color }}
          >
            <path d={platform.path} />
          </svg>
          <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900">
            {platform.label}
          </span>
        </a>
      ))}
    </div>
  );
}
