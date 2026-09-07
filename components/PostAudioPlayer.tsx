'use client';

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

const BAR_HEIGHTS = [40, 65, 90, 55, 30, 70, 45, 85, 35, 60, 95, 50, 25, 75, 40, 65, 90, 55, 30, 70, 45, 85, 60, 40];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PostAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // The browser can finish loading metadata (and fire `loadedmetadata`)
  // before React attaches the listener, especially for small local files —
  // so also check the element directly once mounted.
  useEffect(() => {
    const el = audioRef.current;
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, []);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    const bar = barsRef.current;
    if (!el || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = fraction * duration;
  }

  const progress = duration ? currentTime / duration : 0;

  return (
    <div className="mt-6 rounded-md bg-forest px-[18px] py-[18px]">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-11 w-11 min-w-11 items-center justify-center rounded-full bg-cream"
        >
          <FontAwesomeIcon icon={playing ? faPause : faPlay} className="text-forest" style={{ marginLeft: playing ? 0 : 2, width: 16, height: 16 }} />
        </button>
        <div className="flex-1">
          <p className="mb-0.5 text-[13px] font-medium text-cream">Listen to this post</p>
          <p className="mb-2 text-[11px] text-cream/60">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
          <div
            ref={barsRef}
            onClick={seek}
            className="flex h-4 cursor-pointer items-end gap-[2px]"
          >
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                style={{
                  height: `${h}%`,
                  background: i / BAR_HEIGHTS.length <= progress ? 'rgba(242,237,227,0.85)' : 'rgba(242,237,227,0.35)',
                }}
                className="w-[3px] rounded-[1px]"
              />
            ))}
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
      />
    </div>
  );
}
