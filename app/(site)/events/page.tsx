import { readData } from '@/lib/dataCache';
import type { Event } from '@/types';
import EventsClient from './EventsClient';

// Static + on-demand revalidation for admin edits, but events also need to
// naturally move from "upcoming" to "past" as their date arrives without any
// admin action — so also revalidate on a 1h timer as a safety net.
export const revalidate = 3600;

export const metadata = {
  title: 'Events | The Break Surf',
  description: 'Litter picks, markets, and community events from The Break Surf.',
};

export default async function EventsPage() {
  const data = await readData<Event>('events');
  const now = new Date();
  const events = data
    .filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = data
    .filter(e => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return <EventsClient events={events} pastEvents={pastEvents} />;
}
