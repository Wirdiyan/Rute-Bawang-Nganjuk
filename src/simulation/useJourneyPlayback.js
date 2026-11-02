import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sampleJourney } from './routeJourney.js';

export default function useJourneyPlayback(model, enabled) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeMs, setTimeMs] = useState(0);
  const elapsed = useRef(0);
  const markerRef = useRef(null);
  const trailRef = useRef(null);
  const nodeRendererRef = useRef(null);
  // Register SVG renderers against the current clock after a route reset,
  // even before React has repainted the corresponding text labels.
  const getCurrentFrame = useCallback(() => model ? sampleJourney(model, elapsed.current) : null, [model]);
  const draw = useCallback((time, drawTrail = true) => {
    if (!model) return null;
    const frame = sampleJourney(model, time);
    markerRef.current?.setLatLng(frame.position);
    if (drawTrail) trailRef.current?.setLatLngs([...model.coordinates.slice(0, frame.coordinateIndex + 1), frame.position]);
    nodeRendererRef.current?.(frame);
    return frame;
  }, [model]);
  useEffect(() => {
    elapsed.current = 0;
    setTimeMs(0); setPlaying(false); draw(0);
  }, [model, draw]);
  useEffect(() => {
    if (!enabled) setPlaying(false);
    draw(elapsed.current);
  }, [enabled, draw]);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!playing || !enabled || !model) return undefined;
    let animation;
    let last = performance.now();
    let paintedAt = last;
    const tick = (now) => {
      elapsed.current = Math.min(model.totalMs, elapsed.current + Math.max(0, now - last) * speed);
      last = now;
      const repaint = now - paintedAt >= 120 || elapsed.current === model.totalMs;
      draw(elapsed.current, repaint);
      // Move only the Leaflet marker each frame; update React text ~8 times/s.
      if (repaint) { setTimeMs(elapsed.current); paintedAt = now; }
      if (elapsed.current >= model.totalMs) { setPlaying(false); return; }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [playing, enabled, model, speed, draw]);
  const frame = useMemo(() => model ? sampleJourney(model, timeMs) : null, [model, timeMs]);
  const toggle = () => {
    if (!model || !enabled) return;
    if (playing) { setPlaying(false); setTimeMs(elapsed.current); return; }
    if (elapsed.current >= model.totalMs) { elapsed.current = 0; setTimeMs(0); draw(0); }
    setPlaying(true);
  };
  const reset = () => { setPlaying(false); elapsed.current = 0; setTimeMs(0); draw(0); };
  const seek = (fraction) => {
    if (!model) return;
    setPlaying(false); elapsed.current = Math.max(0, Math.min(1, fraction)) * model.totalMs;
    setTimeMs(elapsed.current); draw(elapsed.current);
  };
  return { playing, speed, setSpeed, timeMs, frame, getCurrentFrame, toggle, reset, seek, markerRef, trailRef, nodeRendererRef };
}
