'use client';

import { useEffect } from 'react';

// No rubber-band at the very top of the page — a trackpad fling or a finger
// dragged past the first pixel pulls nothing down, so the cream page
// background never flashes above the hero. The bounce at the bottom edge
// still works: this only fires when the document is already at 0 and the
// gesture wants to go further.
//
// `overscroll-behavior-y: none` would have been one line, but it is an
// all-or-nothing axis switch and would kill the bottom bounce too. So the
// gesture is cancelled instead — and only when no inner scroller (carousel,
// drawer) could have absorbed it, so those keep scrolling normally.

function canAbsorb(node: EventTarget | null): boolean {
  let el = node instanceof Element ? node : null;
  while (el && el !== document.documentElement) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) {
      return true; // an inner list still has room to scroll back toward its top
    }
    el = el.parentElement;
  }
  return false;
}

export default function TopEdgeGuard() {
  useEffect(() => {
    // Safari makes wheel/touchmove listeners on the document passive by
    // default; opting out explicitly is what makes preventDefault stick.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY >= 0) return; // toward the top only
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // horizontal wheel
      if (window.scrollY > 0 || canAbsorb(e.target)) return;
      e.preventDefault();
    };

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dy <= 0) return; // finger moving up — normal scroll away from the top
      if (Math.abs(dx) > Math.abs(dy)) return; // swiping sideways, not pulling
      if (window.scrollY > 0 || canAbsorb(e.target)) return;
      e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return null;
}
