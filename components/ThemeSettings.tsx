'use client';

import { useTheme, type ThemePreference } from '@/components/ThemeProvider';

const options: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'Device', description: 'Follow your device or browser' },
  { value: 'light', label: 'Light', description: 'Use the light theme' },
  { value: 'dark', label: 'Navy dark', description: 'Use the navy theme' },
];

export default function ThemeSettings() {
  const { preference, setPreference } = useTheme();

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
        <p className="text-sm text-gray-500">By default, the panels follow your device or browser preference.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-2 sm:flex sm:gap-2">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            aria-pressed={preference === option.value}
            className={`flex flex-1 items-center justify-between rounded-lg px-4 py-3 text-left transition-colors sm:block ${
              preference === option.value ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
