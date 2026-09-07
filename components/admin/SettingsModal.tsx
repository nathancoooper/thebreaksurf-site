'use client';

import { useState } from 'react';
import AccountSettings from '@/components/admin/AccountSettings';
import UserManagement from '@/components/admin/UserManagement';
import BackupSettings from '@/components/admin/BackupSettings';
import StorageSettings from '@/components/admin/StorageSettings';
import ThemeSettings from '@/components/ThemeSettings';

type SettingsCategory = 'general' | 'account' | 'users' | 'backup' | 'storage';

const CATEGORIES: { id: SettingsCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'users', label: 'Users' },
  { id: 'storage', label: 'Storage' },
  { id: 'backup', label: 'Backup & Restore' },
];

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [active, setActive] = useState<SettingsCategory>('general');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <nav className="w-52 shrink-0 border-r border-gray-100 bg-gray-50 p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
          </div>
          <div className="space-y-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${active === cat.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {CATEGORIES.find(c => c.id === active)?.label}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
          </div>

          <div className="mt-6 space-y-8">
            {active === 'general' && (
              <ThemeSettings />
            )}

            {active === 'account' && (
              <AccountSettings />
            )}

            {active === 'users' && (
              <UserManagement />
            )}

            {active === 'storage' && (
              <StorageSettings />
            )}

            {active === 'backup' && (
              <BackupSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}