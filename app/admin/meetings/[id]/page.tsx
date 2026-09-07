'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUpload } from '@/components/admin/UploadManager';

// Video upload has been removed for Cloudflare migration
// Meetings can still be created but without video support

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { startUpload, uploads } = useUpload();

  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/meetings/${id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load meeting');
        const data = await res.json();
        setMeeting(data.meeting);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!meeting) return <div className="p-8">Meeting not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/meetings" className="text-sm text-charcoal/60 hover:text-charcoal">
          ← Back to meetings
        </Link>
      </div>

      <h1 className="font-display text-3xl font-medium text-charcoal mb-4">
        {meeting.title || 'Untitled Meeting'}
      </h1>

      <div className="bg-white rounded-lg border border-charcoal/10 p-6">
        <p className="text-charcoal/60">
          Video upload has been disabled for Cloudflare migration.
          <br />
          Meeting notes and attachments are still supported.
        </p>
      </div>
    </div>
  );
}
