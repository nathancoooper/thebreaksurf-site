'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

const PATH  = 'M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z';
const LERP   = 0.12;
const P_LIFE = 600;
const P_INT  = 60;

const SVG_FIXED: React.CSSProperties = { position: 'fixed', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%,-50%)', transition: 'opacity 0.3s ease' };
const PARTICLE_BASE: React.CSSProperties = { position: 'fixed', pointerEvents: 'none', zIndex: 9998, transform: 'translate(-50%,-50%)' };

interface Scheme { main: string; particle: string; }
const DEFAULT: Scheme = { main: '#E06090', particle: '#F0A8C8' };
const HOVER:   Scheme = { main: '#4A7ED9', particle: '#8AB4EE' };

interface Particle { id: number; x: number; y: number; ox: number; oy: number; color: string; }

const Ctx = createContext<{ setScheme: (s: Scheme) => void } | null>(null);

/** Wrap any child element to switch the heart colour scheme on hover */
export function HeartColorZone({ children }: { children: React.ReactNode }) {
  const ctx = useContext(Ctx);
  return (
    <span
      onMouseEnter={() => ctx?.setScheme(HOVER)}
      onMouseLeave={() => ctx?.setScheme(DEFAULT)}
    >
      {children}
    </span>
  );
}

/** Wrap an area to show the heart cursor */
export default function HeartCursor({ children }: { children: React.ReactNode }) {
  const [pos,       setPos]       = useState({ x: -300, y: -300 });
  const [visible,   setVisible]   = useState(false);
  const [scheme,    setScheme]    = useState<Scheme>(DEFAULT);
  const [particles, setParticles] = useState<Particle[]>([]);

  const target    = useRef({ x: -300, y: -300 });
  const current   = useRef({ x: -300, y: -300 });
  const rafId     = useRef<number>(0);
  const lastSpawn = useRef<number>(0);
  const pid       = useRef(0);
  const hovering  = useRef(false);
  const schemeRef = useRef<Scheme>(DEFAULT);

  useEffect(() => { schemeRef.current = scheme; }, [scheme]);

  useEffect(() => {
    const h = (e: MouseEvent) => { target.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', h, { passive: true });
    return () => window.removeEventListener('mousemove', h);
  }, []);

  useEffect(() => {
    function tick(t: number) {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        current.current.x += dx * LERP;
        current.current.y += dy * LERP;
        setPos({ x: current.current.x, y: current.current.y });
      }
      if (hovering.current && t - lastSpawn.current > P_INT) {
        lastSpawn.current = t;
        const angle = Math.random() * Math.PI * 2;
        const dist  = 5 + Math.random() * 8;
        const id    = pid.current++;
        const c     = schemeRef.current.particle;
        setParticles(prev => [...prev, {
          id, color: c,
          x: current.current.x, y: current.current.y,
          ox: Math.cos(angle) * dist, oy: Math.sin(angle) * dist,
        }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), P_LIFE);
      }
      rafId.current = requestAnimationFrame(tick);
    }
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return (
    <Ctx.Provider value={{ setScheme }}>
      <div
        onMouseEnter={e => {
          current.current = { x: e.clientX, y: e.clientY };
          target.current  = { x: e.clientX, y: e.clientY };
          setPos({ x: e.clientX, y: e.clientY });
          hovering.current = true;
          setVisible(true);
        }}
        onMouseMove={e => { target.current = { x: e.clientX, y: e.clientY }; }}
        onMouseLeave={() => { hovering.current = false; setVisible(false); }}
        style={{ cursor: 'none' }}
      >
        {children}
      </div>

      {particles.map(p => (
        <svg key={p.id} width="9" height="9" viewBox="0 0 24 24" aria-hidden
          style={{
            ...PARTICLE_BASE,
            left: p.x + p.ox,
            top: p.y + p.oy,
            animation: `tbs-particle ${P_LIFE}ms ease-out forwards`,
          }}
        >
          <path fill={p.color} d={PATH} />
        </svg>
      ))}

      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden
        style={{ ...SVG_FIXED, left: pos.x, top: pos.y, opacity: visible ? 1 : 0 }}
      >
        <path fill={scheme.main} d={PATH} style={{ transition: 'fill 0.3s ease' }} />
      </svg>
    </Ctx.Provider>
  );
}
