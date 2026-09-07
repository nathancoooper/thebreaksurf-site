'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import type { Event } from '@/types';
import GradientPlaceholder from '@/components/GradientPlaceholder';

const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });


function googleCalUrl(event: Event) {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(event.name)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${encodeURIComponent(event.description)}` +
    `&location=${encodeURIComponent(event.location)}`
  );
}

function EventTooltip({ event, anchorRef, onMouseEnter, onMouseLeave }: {
  event: Event;
  anchorRef: React.RefObject<HTMLElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const tooltipW = 260;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
    setPos({ top: rect.bottom + 4, left });
  }, [anchorRef]);

  if (!pos) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="pointer-events-auto fixed z-[200] w-64 rounded-lg border border-charcoal/10 bg-cream shadow-lg"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="border-b border-charcoal/10 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-terra">
          {new Date(event.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="mt-0.5 font-display text-base font-medium text-charcoal">{event.name}</p>
        <p className="mt-0.5 text-xs text-charcoal/50">
          {new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {event.location}
        </p>
      </div>
      <div className="flex gap-2 px-4 py-3">
        <a
          href={googleCalUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-charcoal/20 py-1.5 text-xs font-medium text-charcoal transition hover:border-charcoal/40 hover:bg-charcoal/5"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Google
        </a>
        <a
          href={`/api/events/${event.id}/ical`}
          download
          className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-charcoal/20 py-1.5 text-xs font-medium text-charcoal transition hover:border-charcoal/40 hover:bg-charcoal/5"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Apple / iCal
        </a>
      </div>
    </div>
  );
}

type CalendarHandle = {
  goToDate: (iso: string) => void;
  activateEvent: (eventId: string) => void;
  deactivateEvent: () => void;
};

const Calendar = forwardRef<CalendarHandle, { events: Event[]; pastEvents: Event[] }>(function Calendar({ events, pastEvents }, ref) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);
  const hoveredRef = useRef<HTMLButtonElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pendingActivation, setPendingActivation] = useState<string | null>(null);

  // After month re-render, button refs are populated — now we can resolve the pending activation
  useEffect(() => {
    if (!pendingActivation) return;
    const btn = buttonRefs.current.get(pendingActivation);
    if (!btn) return;
    const ev = [...events, ...pastEvents].find(e => e.id === pendingActivation);
    if (ev) {
      hoveredRef.current = btn;
      setHoveredEvent(ev);
    }
    setPendingActivation(null);
  }, [pendingActivation, year, month, events, pastEvents]);

  useImperativeHandle(ref, () => ({
    goToDate(iso: string) {
      const d = new Date(iso);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    },
    activateEvent(eventId: string) {
      const ev = [...events, ...pastEvents].find(e => e.id === eventId);
      if (ev) {
        const d = new Date(ev.date);
        setYear(d.getFullYear());
        setMonth(d.getMonth());
      }
      setPendingActivation(eventId);
    },
    deactivateEvent() {
      setHoveredEvent(null);
      setPendingActivation(null);
    },
  }), [events, pastEvents]);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setHoveredEvent(null), 150);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;

  const eventsByDay: Record<number, Event[]> = {};
  const pastEventsByDay: Record<number, Event[]> = {};

  events.forEach(ev => {
    const d = new Date(ev.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  });

  pastEvents.forEach(ev => {
    const d = new Date(ev.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!pastEventsByDay[day]) pastEventsByDay[day] = [];
      pastEventsByDay[day].push(ev);
    }
  });

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthName = new Date(year, month).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  return (
    <div className="flex flex-col">
      {/* Month nav */}
      <div className="mb-6 flex items-center justify-between">
        <button onClick={prev} className="rounded p-1.5 text-charcoal/50 transition hover:bg-charcoal/5 hover:text-charcoal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <p className="text-sm font-semibold text-charcoal">{monthName}</p>
        <button onClick={next} className="rounded p-1.5 text-charcoal/50 transition hover:bg-charcoal/5 hover:text-charcoal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border border-charcoal/15">
        <div className="grid grid-cols-7 border-b border-charcoal/15">
          {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
            <p key={d} className="border-r border-charcoal/10 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-charcoal/30 last:border-r-0">{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isLastRow = i >= cells.length - 7;
            const isLastCol = (i + 1) % 7 === 0;
            const borderCls = `${!isLastRow ? 'border-b' : ''} ${!isLastCol ? 'border-r' : ''} border-charcoal/10`;

            if (!day) return <div key={i} className={`aspect-square bg-charcoal/[0.02] ${borderCls}`} />;

            const evs = eventsByDay[day] ?? [];
            const pevs = pastEventsByDay[day] ?? [];
            const allEvs = [...evs, ...pevs];
            const isUpcoming = evs.length > 0;
            const isPast = pevs.length > 0 && evs.length === 0;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isHovered = hoveredEvent && allEvs.includes(hoveredEvent);

            return (
              <button
                key={i}
                ref={el => {
                  // Keep a map of event id → button so card hovers can find the right cell
                  if (allEvs.length) {
                    if (el) allEvs.forEach(ev => buttonRefs.current.set(ev.id, el));
                    else allEvs.forEach(ev => buttonRefs.current.delete(ev.id));
                  }
                  if (isHovered) hoveredRef.current = el;
                }}
                onMouseEnter={e => {
                  if (allEvs.length) {
                    cancelHide();
                    hoveredRef.current = e.currentTarget;
                    setHoveredEvent(allEvs[0]);
                  }
                }}
                onMouseLeave={() => { if (allEvs.length) scheduleHide(); }}
                className={`relative flex aspect-square flex-col items-center justify-center transition-colors ${borderCls}
                  ${isUpcoming ? 'cursor-pointer bg-terra/10 hover:bg-terra/25' : ''}
                  ${isPast ? 'cursor-pointer bg-forest/10 hover:bg-forest/20' : ''}
                  ${!isUpcoming && !isPast ? 'cursor-default hover:bg-charcoal/5' : ''}
                  ${isHovered && isUpcoming ? '!bg-terra/30' : ''}
                  ${isHovered && isPast ? '!bg-forest/25' : ''}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isToday ? 'bg-charcoal text-cream' : 'text-charcoal/80'
                }`}>
                  {day}
                </span>
                {(isUpcoming || isPast) && (
                  <span className="mt-0.5 flex gap-0.5">
                    {allEvs.slice(0, 3).map((_, j) => (
                      <span key={j} className={`h-1 w-1 rounded-full ${isUpcoming ? 'bg-terra' : 'bg-forest'}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {hoveredEvent && <EventTooltip event={hoveredEvent} anchorRef={hoveredRef} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />}
    </div>
  );
});

export default function EventsClient({ events, pastEvents }: { events: Event[]; pastEvents: Event[] }) {
  const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);
  const calendarRef = useRef<CalendarHandle>(null);


  const introBlock = (
    <>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-terra">
        What&apos;s on
      </p>
      <h1 className="font-display text-5xl font-medium leading-tight text-charcoal">
        Come find us.
      </h1>
      <p className="mt-5 max-w-sm text-sm leading-relaxed text-charcoal/60">
        We run monthly litter picks, pop-up stores, and occasional collaborations. Everything is free and open to anyone. Hover over a highlighted day to add it to your calendar.
      </p>
    </>
  );

  const upcomingBlock = events.length > 0 && (
    <div className="mt-14">
      <p className="mb-6 text-xs font-medium uppercase tracking-widest text-charcoal/40">Upcoming events</p>
      <div className="grid grid-cols-2 gap-4">
        {events.map(ev => (
          <div
            key={ev.id}
            className="group"
            onMouseEnter={() => { calendarRef.current?.activateEvent(ev.id); setHoveredMapId(ev.id); }}
            onMouseLeave={() => { calendarRef.current?.deactivateEvent(); setHoveredMapId(null); }}
          >
            <div className="overflow-hidden rounded-sm bg-sage/15">
              <div className="relative aspect-[4/3] w-full">
                <div className={`absolute inset-0 transition-opacity duration-500 ${hoveredMapId === ev.id ? 'opacity-0' : 'opacity-100'}`}>
                  {ev.cover ? (
                    <Image src={ev.cover} alt={ev.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-[2500ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] group-hover:scale-125" />
                  ) : (
                    <GradientPlaceholder seed={ev.id} className="absolute inset-0 h-full w-full" />
                  )}
                </div>
                <div className={`absolute inset-0 isolate overflow-hidden transition-opacity duration-500 ${hoveredMapId === ev.id ? 'opacity-100' : 'opacity-0'}`}>
                  <EventMap
                    location={ev.location}
                    coords={ev.lat != null && ev.lng != null ? [ev.lat, ev.lng] : undefined}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <time className="text-xs font-medium uppercase tracking-widest text-terra">
                {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
              <p className="font-display mt-1 text-base font-medium text-charcoal">{ev.name}</p>
              <p className="mt-0.5 text-xs text-charcoal/50">{ev.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const pastBlock = pastEvents.length > 0 && (
    <div className="mt-14">
      <p className="mb-6 text-xs font-medium uppercase tracking-widest text-charcoal/40">Past events</p>
      <div className="grid grid-cols-2 gap-4">
        {pastEvents.map(ev => (
          <div
            key={ev.id}
            className="group"
            onMouseEnter={() => { calendarRef.current?.activateEvent(ev.id); setHoveredMapId(ev.id); }}
            onMouseLeave={() => { calendarRef.current?.deactivateEvent(); setHoveredMapId(null); }}
          >
            <div className="overflow-hidden rounded-sm bg-sage/15">
              <div className="relative aspect-[4/3] w-full">
                <div className={`absolute inset-0 transition-opacity duration-500 ${hoveredMapId === ev.id ? 'opacity-0' : 'opacity-100'}`}>
                  {ev.cover ? (
                    <Image src={ev.cover} alt={ev.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-[2500ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] group-hover:scale-125" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-forest/40 to-moss/20" />
                  )}
                </div>
                <div className={`absolute inset-0 isolate overflow-hidden transition-opacity duration-500 ${hoveredMapId === ev.id ? 'opacity-100' : 'opacity-0'}`}>
                  <EventMap
                    location={ev.location}
                    coords={ev.lat != null && ev.lng != null ? [ev.lat, ev.lng] : undefined}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <time className="text-xs font-medium uppercase tracking-widest text-charcoal/40">
                {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
              <p className="font-display mt-1 text-base font-medium text-charcoal">{ev.name}</p>
              <p className="mt-0.5 text-xs text-charcoal/50">{ev.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: left column scrolls with page; right column sticks in viewport */}
      <div className="hidden lg:-mt-[72px] lg:flex">
        <div className="w-1/2 border-r border-charcoal/10 px-12 pb-16 pt-[calc(72px+4rem)]">
          {introBlock}
          {upcomingBlock}
          {pastBlock}
        </div>
        <div className="sticky top-[72px] flex h-[calc(100vh-72px)] w-1/2 flex-col justify-center overflow-hidden px-12 py-16">
          <Calendar ref={calendarRef} events={events} pastEvents={pastEvents} />
        </div>
      </div>

      {/* Mobile / tablet: stacked, scrollable */}
      <div className="flex flex-col lg:hidden">
        <div className="px-6 py-12 sm:px-10">
          {introBlock}
        </div>
        <div className="border-t border-charcoal/10 px-6 py-10 sm:px-10">
          <Calendar events={events} pastEvents={pastEvents} />
        </div>
        {events.length > 0 && (
          <div className="border-t border-charcoal/10 px-6 py-10 sm:px-10">
            {upcomingBlock}
          </div>
        )}
        {pastEvents.length > 0 && (
          <div className="border-t border-charcoal/10 px-6 py-10 sm:px-10">
            {pastBlock}
          </div>
        )}
      </div>
    </>
  );
}
