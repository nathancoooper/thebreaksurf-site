import AccountSettings from '@/components/admin/AccountSettings';
import BackupSettings from '@/components/admin/BackupSettings';
import ThemeSettings from '@/components/ThemeSettings';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400">Site controls and account settings.</p>
      </div>

      <div className="space-y-10">
        <AccountSettings />

        <ThemeSettings />

        <BackupSettings />
      </div>
    </div>
  );
}
