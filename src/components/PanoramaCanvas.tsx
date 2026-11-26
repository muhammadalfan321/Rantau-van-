import { useEffect, useRef } from 'react';
import { ALFAN_LINES } from '../data/journey';
import {
  clamp,
  computeCompassState,
  computeHudReadout,
  computeUiPalette,
  computeWeatherState,
  formatBearing,
  hexToRgb,
  lerp,
  mixRgb,
  RGB,
  rgbCss,
  smoothstep,
} from '../utils/journeyMath';

const PALETTE_HEX = {
  skyTop: ['#3a93e0', '#2f3d7d', '#050b1f', '#040817'],
  skyMid: ['#86c8f2', '#a5527f', '#0a1a3c', '#09152f'],
  skyHor: ['#e6f6fc', '#ff9a4d', '#1a3560', '#27406e'],
  farMtn: ['#8fbcd9', '#6b5593', '#0f1e40', '#0b1631'],
  midMtn: ['#6aa0c0', '#4d3d6e', '#0b1832', '#08122a'],
  water1: ['#bfe4f4', '#e98f68', '#17335c', '#1d3862'],
  water2: ['#2f86b8', '#3a3b73', '#050d22', '#040a1a'],
  rock: ['#6a665c', '#3e2f42', '#111a2b', '#0b1322'],
  foliage: ['#4a9a55', '#3b5b45', '#0e2b2c', '#0a2125'],
  grass: ['#2d6a44', '#26394a', '#0b1d22', '#0a1a20'],
  grass2: ['#1d4a34', '#17242f', '#050f12', '#030a0d'],
  reed: ['#2e6b52', '#1f3a45', '#06141b', '#040d12'],
} as const;

type PaletteKey = keyof typeof PALETTE_HEX;

const PAL: Record<PaletteKey, RGB[]> = Object.fromEntries(
  Object.entries(PALETTE_HEX).map(([k, arr]) => [k, arr.map(hexToRgb)]),
) as Record<PaletteKey, RGB[]>;

const hsh = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Comet {
  big: boolean;
  x: number;
  y: number;
  a: number;
  v: number;
  life: number;
  max: number;
  trail: { x: number; y: number }[];
  sp: { x: number; y: number; vx: number; vy: number; l: number }[];
  size: number;
  curve: number;
  frozen?: boolean;
}

export interface PanoramaCanvasProps {
  trackRef: React.RefObject<HTMLElement | null>;
  clockElRef: React.RefObject<HTMLSpanElement | null>;
  tempElRef: React.RefObject<HTMLElement | null>;
  compassElRef: React.RefObject<HTMLDivElement | null>;
  compassNeedleRef: React.RefObject<SVGGElement | null>;
  compassBearingRef: React.RefObject<HTMLSpanElement | null>;
  hintElRef: React.RefObject<HTMLDivElement | null>;
  sayElRef: React.RefObject<HTMLDivElement | null>;
  sceneRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  dotRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
}

export function PanoramaCanvas({
  trackRef,
  clockElRef,
  tempElRef,
  compassElRef,
  compassNeedleRef,
  compassBearingRef,
  hintElRef,
  sayElRef,
  sceneRefs,
  dotRefs,
}: PanoramaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    const rnd = createRng(11);

    const stars = Array.from({ length: 240 }, () => ({
      x: rnd(),
      y: Math.pow(rnd(), 1.3),
      r: rnd() < 0.08 ? 2 : rnd() < 0.3 ? 1.4 : 1,
      ph: rnd() * 6.28,
      tw: 0.8 + rnd() * 2.2,
    }));
    const clouds = Array.from({ length: 7 }, () => ({
      wx: -0.5 + rnd() * 3,
      y: 0.07 + rnd() * 0.26,
      s: 0.6 + rnd() * 0.9,
      sp: 0.004 + rnd() * 0.006,
      p: Array.from({ length: 6 }, () => ({
        dx: (rnd() - 0.5) * 1.5,
        dy: (rnd() - 0.5) * 0.28,
        r: 0.26 + rnd() * 0.3,
      })),
    }));
    const lights = Array.from({ length: 110 }, () => ({
      wx: 1.3 + rnd() * 2.4,
      dy: rnd() * 5,
      ph: rnd() * 6.28,
      r: 0.7 + rnd(),
      c: (rnd() < 0.3 ? [255, 217, 160] : [255, 191, 110]) as RGB,
    }));
    const reeds = Array.from({ length: 80 }, () => ({
      wx: -0.9 + rnd() * 3.5,
      h: 0.1 + rnd() * 0.17,
      lean: (rnd() - 0.5) * 0.08,
      ph: rnd() * 6.28,
      head: rnd() < 0.45,
      dy: rnd() * 0.03,
    }));
    const ripples = Array.from({ length: 130 }, () => ({
      ny: rnd(),
      nx: rnd(),
      len: 0.4 + rnd(),
      a: 0.3 + rnd() * 0.7,
      sp: 0.2 + rnd() * 0.8,
      ph: rnd() * 6.28,
    }));
    const flies = Array.from({ length: 26 }, () => ({
      x: rnd(),
      y: 0.55 + rnd() * 0.4,
      ph: rnd() * 6.28,
      sp: 0.3 + rnd() * 0.5,
      r: 1 + rnd() * 1.5,
    }));
    const pines = Array.from({ length: 22 }, () => ({
      wx: 2.5 + rnd() * 1.9,
      h: 0.05 + rnd() * 0.07,
      w: 0.5 + rnd() * 0.3,
    }));
    const mistLayers = Array.from({ length: 14 }, (_, idx) => ({
      wx: -0.7 + rnd() * 4.4,
      yOff: (rnd() - 0.5) * 0.14,
      rx: 0.16 + rnd() * 0.2,
      ry: 0.025 + rnd() * 0.032,
      sp: (idx % 2 === 0 ? 1 : -1) * (0.008 + rnd() * 0.012),
      ph: rnd() * 6.28,
      a: 0.35 + rnd() * 0.45,
    }));
    const rainDrops = Array.from({ length: 150 }, () => ({
      x: rnd(),
      y: rnd(),
      len: 10 + rnd() * 14,
      sp: 0.72 + rnd() * 0.48,
      a: 0.2 + rnd() * 0.45,
      splashSeed: rnd(),
    }));

    let W = 0;
    let H = 0;
    let DPR = 1;
    let HOR = 0;
    let U = 0;
    let R = 0;
    let sunY1 = 0;
    let frozen: Comet | null = null;

    let tc = 0;
    let target = 0;
    let mxs = 0;
    let mxT = 0;
    let night = 0;
    let sunsetK = 0;
    let lightsOn = 0;

    const comets: Comet[] = [];
    let tShoot = 1.5;
    let tBig = 0.7;

    const anchor: ({ x: number; y: number } | null)[] = [null, null, null, null];

    const col = (name: PaletteKey): RGB => {
      const a = PAL[name];
      const i = Math.min(2, Math.floor(tc));
      return mixRgb(a[i], a[i + 1], smoothstep(0, 1, tc - i));
    };

    const sx = (wx: number, f: number): number =>
      W * (0.5 + (wx - tc) * f) + mxs * W * 0.04 * f;

    const glow = (x: number, y: number, r: number, c: RGB, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgbCss(c, a));
      g.addColorStop(1, rgbCss(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      HOR = H * 0.6;
      U = Math.max(Math.min(W, H * 1.5), H * 0.55);
      R = Math.min(Math.max(H * 0.15, W * 0.11), W * 0.3);
      sunY1 = HOR + 0.045 * H - R;
      frozen = null;
    };

    const makeComet = (big: boolean, x: number, y: number, a: number): Comet => ({
      big,
      x,
      y,
      a,
      v: big ? W * 0.3 : W * 0.55,
      life: 0,
      max: big ? 3.6 : 1.1,
      trail: [],
      sp: [],
      size: big ? Math.max(4.5, U * 0.0042) : 1.4,
      curve: big ? 0.09 : 0,
    });

    const stepComet = (c: Comet, dt: number) => {
      c.life += dt;
      c.a += c.curve * dt;
      c.x += Math.cos(c.a) * c.v * dt;
      c.y += Math.sin(c.a) * c.v * dt;
      c.trail.push({ x: c.x, y: c.y });
      if (c.trail.length > (c.big ? 90 : 26)) c.trail.shift();
      if (c.big) {
        for (let i = 0; i < 2; i++) {
          c.sp.push({
            x: c.x,
            y: c.y,
            vx: (Math.random() - 0.5) * 34,
            vy: (Math.random() - 0.5) * 34 + 10,
            l: 0,
          });
        }
      }
      for (const s of c.sp) {
        s.l += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      c.sp = c.sp.filter((s) => s.l < 0.9);
    };

    const drawComet = (c: Comet) => {
      const n = c.trail.length;
      if (n < 2) return;
      const a = Math.min(1, c.life / 0.25, (c.max - c.life) / 0.6);
      if (a <= 0 && !c.frozen) return;
      const al = c.frozen ? 1 : a;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < n; i++) {
          const k = i / n;
          const p = c.trail[i - 1];
          const q = c.trail[i];
          ctx.strokeStyle = c.big
            ? `rgba(255,${(190 + 40 * k) | 0},${(110 + 90 * k) | 0},${
                al * Math.pow(k, 1.7) * (pass ? 0.9 : 0.22)
              })`
            : `rgba(220,235,255,${
                al * Math.pow(k, 1.6) * (pass ? 0.95 : 0.2)
              })`;
          ctx.lineWidth = c.size * (0.4 + k * 2.2) * (pass ? 1 : 3);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
      const h = c.trail[n - 1];
      glow(
        h.x,
        h.y,
        c.size * (c.big ? 10 : 6),
        c.big ? [255, 214, 130] : [210, 230, 255],
        0.9 * al,
      );
      ctx.fillStyle = `rgba(255,255,255,${al})`;
      ctx.beginPath();
      ctx.arc(h.x, h.y, c.size * 0.9, 0, 6.3);
      ctx.fill();
      for (const s of c.sp) {
        ctx.fillStyle = `rgba(255,220,150,${al * (1 - s.l / 0.9) * 0.8})`;
        ctx.fillRect(s.x, s.y, 1.6, 1.6);
      }
      ctx.restore();
    };

    const spawnComet = (big: boolean, x: number, y: number, a: number) => {
      comets.push(makeComet(big, x, y, a));
    };

    const autoSpawn = (dt: number) => {
      if (rm) return;
      if (tc > 1.6) {
        tShoot -= dt;
        if (tShoot <= 0) {
          tShoot = 2.5 + Math.random() * 4;
          spawnComet(
            false,
            W * (0.1 + Math.random() * 0.7),
            H * (0.04 + Math.random() * 0.25),
            0.35 + Math.random() * 0.5,
          );
        }
      }
      if (tc > 2.5) {
        tBig -= dt;
        if (tBig <= 0) {
          tBig = 8 + Math.random() * 3;
          spawnComet(
            true,
            W * (0.05 + Math.random() * 0.3),
            H * (0.07 + Math.random() * 0.1),
            0.28 + Math.random() * 0.15,
          );
        }
      }
    };

    const getFrozenComet = () => {
      if (frozen) return frozen;
      const c = makeComet(true, W * 0.12, H * 0.1, 0.3);
      for (let i = 0; i < 80; i++) stepComet(c, 0.016);
      c.sp = [];
      c.frozen = true;
      frozen = c;
      return c;
    };

    const drawSky = (time: number) => {
      const top = col('skyTop');
      const mid = col('skyMid');
      const hor = col('skyHor');
      const g = ctx.createLinearGradient(0, 0, 0, HOR);
      g.addColorStop(0, rgbCss(top));
      g.addColorStop(0.55, rgbCss(mid));
      g.addColorStop(1, rgbCss(hor));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const sunX = W * (0.5 + (1 - tc) * 0.28) + mxs * W * 0.01;
      const sunY = H * 0.16 + (sunY1 - H * 0.16) * Math.pow(Math.max(tc, 0), 1.5);
      const sunR = clamp(U * 0.028, 18, 40) * (1 + 0.5 * sunsetK);
      const sunC = mixRgb([255, 243, 192], [255, 168, 86], sunsetK);
      const afterK = 1 - clamp(Math.abs(tc - 1.15) / 0.9, 0, 1);
      if (afterK > 0.01) {
        ctx.save();
        ctx.translate(sunX, HOR);
        ctx.scale(1, 0.45);
        glow(0, 0, W * 0.75, [255, 140, 80], 0.5 * afterK);
        ctx.restore();
      }

      if (night > 0.01) {
        for (const s of stars) {
          const x = ((((s.x - tc * 0.035 + mxs * 0.01) % 1) + 1) % 1) * W;
          const y = s.y * HOR * 0.92;
          const tw = rm ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.tw + s.ph);
          const a = night * tw * (1 - (y / HOR) * 0.65);
          if (a < 0.03) continue;
          ctx.fillStyle = `rgba(255,250,235,${a})`;
          ctx.fillRect(x, y, s.r, s.r);
          if (s.r >= 2 && a > 0.4) {
            ctx.fillRect(x - 3, y + 0.5, 8, 1);
            ctx.fillRect(x + 0.5, y - 3, 1, 8);
          }
        }
        ctx.save();
        ctx.translate(W * 0.55, HOR * 0.4);
        ctx.rotate(-0.55);
        ctx.scale(3, 1);
        const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, H * 0.3);
        mg.addColorStop(0, `rgba(170,185,255,${0.16 * night})`);
        mg.addColorStop(0.5, `rgba(120,140,220,${0.07 * night})`);
        mg.addColorStop(1, 'rgba(120,140,220,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(0, 0, H * 0.3, 0, 6.3);
        ctx.fill();
        ctx.restore();
      }

      const glowA = 0.6 * (1 - smoothstep(1.3, 2, tc));
      if (glowA > 0.01) {
        glow(
          sunX,
          sunY,
          sunR * 10,
          mixRgb([255, 240, 190], [255, 150, 70], sunsetK),
          glowA,
        );
      }
      if (sunY < HOR + sunR * 2) {
        ctx.fillStyle = rgbCss(sunC);
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, 0, 6.3);
        ctx.fill();
      }

      const cA = 1 - smoothstep(1, 1.7, tc);
      if (cA > 0.01) {
        const cc = mixRgb([255, 255, 255], [255, 183, 160], sunsetK);
        const span = W * 1.6;
        for (const c of clouds) {
          const x =
            ((((W * (0.5 + (c.wx - tc) * 0.35) + (rm ? 0 : time * c.sp * W)) %
              span) +
              span) %
              span) -
            W * 0.3;
          const w = clamp(U * 0.11, 90, 200) * c.s;
          const y = c.y * HOR;
          for (let pass = 0; pass < 2; pass++) {
            ctx.fillStyle = pass
              ? rgbCss(cc, 0.88 * cA)
              : rgbCss(mixRgb(cc, [110, 140, 190], 0.5), 0.22 * cA);
            for (const p of c.p) {
              ctx.beginPath();
              ctx.ellipse(
                x + p.dx * w,
                y + p.dy * w + (pass ? 0 : w * 0.05),
                p.r * w * 0.62,
                p.r * w * 0.36,
                0,
                0,
                6.3,
              );
              ctx.fill();
            }
          }
        }
      }

      const moonA = smoothstep(1.7, 2.4, tc);
      if (moonA > 0.01) {
        const mx = W * 0.8 + mxs * W * 0.012;
        const my = H * 0.17;
        const mr = clamp(U * 0.028, 20, 46);
        glow(mx, my, mr * 7, [190, 210, 255], 0.32 * moonA);
        ctx.fillStyle = `rgba(243,236,210,${moonA})`;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = `rgba(170,160,130,${0.16 * moonA})`;
        for (const [dx, dy, r] of [
          [-0.3, -0.2, 0.22],
          [0.25, 0.1, 0.3],
          [-0.1, 0.38, 0.16],
          [0.4, -0.38, 0.12],
        ]) {
          ctx.beginPath();
          ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.3);
          ctx.fill();
        }
      }
      return { sunX, sunY, sunR, sunC };
    };

    const ridge = (x: number, s: number) =>
      (1 - Math.abs(Math.sin(x * 1.7 + s))) * 0.55 +
      (1 - Math.abs(Math.sin(x * 3.9 + s * 2))) * 0.28 +
      0.17 * (0.5 + 0.5 * Math.sin(x * 9 + s));

    const mtn = (
      name: PaletteKey,
      f: number,
      hgt: number,
      seed: number,
      freq: number,
    ) => {
      ctx.fillStyle = rgbCss(col(name));
      ctx.beginPath();
      ctx.moveTo(-10, HOR + 2);
      for (let x = -10; x <= W + 10; x += 6) {
        const wx = tc + (x / W - 0.5) / f;
        ctx.lineTo(x, HOR - ridge(wx * freq, seed) * hgt);
      }
      ctx.lineTo(W + 10, HOR + 2);
      ctx.closePath();
      ctx.fill();
    };

    const glint = (
      x: number,
      alpha: number,
      c: RGB,
      time: number,
      spread: number,
    ) => {
      if (alpha < 0.01) return;
      for (let i = 0; i < 48; i++) {
        const ny = i / 47;
        const y = HOR + Math.pow(ny, 1.5) * (H - HOR) * 0.75 + 2;
        const j = Math.sin(time * 1.4 + i * 1.9) * (3 + ny * 30 * spread);
        const w =
          (14 + ny * 160 * spread) *
          (0.35 + 0.65 * Math.abs(Math.sin(time * 1.7 + i * 2.3)));
        ctx.fillStyle = rgbCss(
          c,
          alpha *
            (1 - ny * 0.65) *
            (0.4 + 0.6 * Math.abs(Math.sin(i * 5.1 + time))),
        );
        ctx.fillRect(x + j - w / 2, y, w, 1.2 + ny * 2.4);
      }
    };

    const drawWater = () => {
      const w1 = col('water1');
      const w2 = col('water2');
      const g = ctx.createLinearGradient(0, HOR, 0, H);
      g.addColorStop(0, rgbCss(w1));
      g.addColorStop(0.35, rgbCss(mixRgb(w1, w2, 0.55)));
      g.addColorStop(1, rgbCss(w2));
      ctx.fillStyle = g;
      ctx.fillRect(0, HOR, W, H - HOR);
    };

    const drawRipples = (time: number) => {
      const lc = mixRgb([255, 255, 255], [150, 190, 255], smoothstep(0.6, 1.6, tc));
      const sc = Math.max(U / 900, 0.55);
      for (const r of ripples) {
        const ny = Math.pow(r.ny, 1.7);
        const y = HOR + 6 + ny * (H - HOR - 6);
        const M = W * 1.4;
        const x =
          ((((r.nx * M -
            tc * W * (0.5 + ny * 0.9) +
            (rm ? 0 : time * r.sp * 6 * (0.3 + ny))) %
            M) +
            M) %
            M) -
          W * 0.2;
        const len = (18 + r.len * 70) * (0.3 + ny * 1.4) * sc;
        ctx.fillStyle = rgbCss(
          lc,
          0.05 +
            0.16 *
              r.a *
              (rm ? 0.7 : 0.5 + 0.5 * Math.sin(time * r.sp * 2 + r.ph)) *
              (0.4 + ny * 0.8),
        );
        ctx.fillRect(x, y, len, 1 + ny * 1.5);
      }
    };

    const drawTownLights = (time: number) => {
      if (lightsOn < 0.02) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const x = sx(l.wx, 0.5);
        if (x < -5 || x > W + 5) continue;
        const a = lightsOn * (rm ? 0.8 : 0.6 + 0.4 * Math.sin(time * 1.3 + l.ph));
        ctx.fillStyle = rgbCss(l.c, a * 0.9);
        ctx.fillRect(x, HOR - 2 - l.dy, l.r, l.r);
        ctx.fillStyle = rgbCss(l.c, a * 0.22);
        ctx.fillRect(x, HOR + 2, l.r, 4 + l.dy * 2);
      }
      ctx.restore();
    };

    const drawIsland = (cx: number, by: number, r: number, refl: boolean) => {
      const rock = col('rock');
      const fol = col('foliage');
      ctx.save();
      ctx.translate(cx, by);
      if (refl) ctx.scale(1, -0.85);
      const gg = ctx.createLinearGradient(0, -2 * r, 0, 0);
      gg.addColorStop(
        0,
        rgbCss(mixRgb(rock, [255, 200, 150], 0.1 + 0.12 * sunsetK)),
      );
      gg.addColorStop(0.6, rgbCss(rock));
      gg.addColorStop(1, rgbCss(mixRgb(rock, [0, 0, 0], 0.35)));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(-2.5 * r, 0);
      ctx.bezierCurveTo(-2.1 * r, -0.35 * r, -1.6 * r, -0.3 * r, -1.2 * r, -0.52 * r);
      ctx.bezierCurveTo(-0.7 * r, -0.75 * r, -0.4 * r, -0.45 * r, 0, -0.55 * r);
      ctx.bezierCurveTo(0.5 * r, -0.62 * r, 0.9 * r, -0.8 * r, 1.3 * r, -0.5 * r);
      ctx.bezierCurveTo(1.7 * r, -0.3 * r, 2.1 * r, -0.3 * r, 2.6 * r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -r, 0.95 * r, r, 0, 0, 6.2832);
      ctx.moveTo(0.62 * r, -1.06 * r);
      ctx.ellipse(0, -1.06 * r, 0.62 * r, 0.7 * r, 0, 0, 6.2832);
      ctx.fill('evenodd');
      if (sunsetK > 0.05) {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = `rgba(255,170,90,${0.7 * sunsetK})`;
        ctx.beginPath();
        ctx.ellipse(0, -r, 0.95 * r, r, 0, Math.PI * 1.05, Math.PI * 1.75);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255,208,138,${0.6 * sunsetK})`;
        ctx.beginPath();
        ctx.ellipse(0, -1.06 * r, 0.62 * r, 0.7 * r, 0, 0, 6.2832);
        ctx.stroke();
      }
      const hi = mixRgb(fol, [255, 230, 150], 0.22 + 0.2 * sunsetK);
      ctx.fillStyle = rgbCss(mixRgb(rock, [0, 0, 0], 0.4));
      ctx.fillRect(0.27 * r, -2.05 * r, 0.05 * r, 0.14 * r);
      const tree = [
        [0.05, -2.12, 0.34],
        [0.38, -2.2, 0.3],
        [0.7, -2.08, 0.26],
        [-0.2, -2.02, 0.24],
        [0.3, -2, 0.34],
        [0.55, -1.95, 0.22],
        [-1.2, -0.7, 0.2],
        [-1, -0.62, 0.17],
        [-1.4, -0.58, 0.16],
      ];
      ctx.fillStyle = rgbCss(fol);
      for (const [x, y, s] of tree) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, s * r, 0, 6.3);
        ctx.fill();
      }
      ctx.fillStyle = rgbCss(hi, 0.4);
      for (const [x, y, s] of tree) {
        ctx.beginPath();
        ctx.arc((x - 0.06) * r, (y - 0.08) * r, s * r * 0.55, 0, 6.3);
        ctx.fill();
      }
      {
        const fx = -0.38 * r;
        const fy = -1.9 * r;
        const h = 0.3 * r;
        const dk = mixRgb([64, 70, 104], [14, 22, 36], night);
        ctx.fillStyle = rgbCss(dk);
        ctx.beginPath();
        ctx.ellipse(fx, fy - h * 0.38, h * 0.15, h * 0.3, 0, 0, 6.3);
        ctx.fill();
        ctx.fillRect(fx - h * 0.11, fy - h * 0.12, h * 0.08, h * 0.12);
        ctx.fillRect(fx + h * 0.03, fy - h * 0.12, h * 0.08, h * 0.12);
        ctx.fillStyle = '#e8b98a';
        ctx.beginPath();
        ctx.arc(fx + h * 0.02, fy - h * 0.8, h * 0.09, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = '#e3c37a';
        ctx.beginPath();
        ctx.moveTo(fx - h * 0.17, fy - h * 0.82);
        ctx.lineTo(fx + h * 0.02, fy - h * 1.02);
        ctx.lineTo(fx + h * 0.21, fy - h * 0.82);
        ctx.closePath();
        ctx.fill();
      }
      if (lightsOn > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [x, y] of [
          [-0.4, -0.45],
          [0.6, -0.6],
          [1.5, -0.4],
          [-1.8, -0.25],
          [-0.1, -0.5],
        ]) {
          glow(x * r, y * r, r * 0.22, [255, 190, 110], 0.7 * lightsOn);
          ctx.fillStyle = `rgba(255,225,160,${lightsOn})`;
          ctx.fillRect(x * r - 1.5, y * r - 1.5, 3, 3);
        }
        ctx.restore();
      }
      ctx.restore();
    };

    const drawBoat = (
      x: number,
      y: number,
      w: number,
      refl: boolean,
      time: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      if (refl) ctx.scale(1, -0.8);
      if (!rm) {
        ctx.translate(0, Math.sin(time * 1.1) * w * 0.006);
        ctx.rotate(Math.sin(time * 0.8) * 0.012);
      }
      ctx.fillStyle = '#5b3a2a';
      ctx.beginPath();
      ctx.moveTo(-0.52 * w, -0.13 * w);
      ctx.quadraticCurveTo(-0.4 * w, 0.02 * w, -0.2 * w, 0.04 * w);
      ctx.lineTo(0.25 * w, 0.04 * w);
      ctx.quadraticCurveTo(0.46 * w, 0, 0.54 * w, -0.1 * w);
      ctx.quadraticCurveTo(0.2 * w, -0.06 * w, -0.1 * w, -0.05 * w);
      ctx.quadraticCurveTo(-0.35 * w, -0.06 * w, -0.52 * w, -0.13 * w);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#a46f45';
      ctx.lineWidth = Math.max(1.5, w * 0.01);
      ctx.beginPath();
      ctx.moveTo(0.54 * w, -0.1 * w);
      ctx.quadraticCurveTo(0.2 * w, -0.06 * w, -0.1 * w, -0.05 * w);
      ctx.quadraticCurveTo(-0.35 * w, -0.06 * w, -0.52 * w, -0.13 * w);
      ctx.stroke();
      ctx.fillStyle = '#caa45a';
      ctx.beginPath();
      ctx.ellipse(-0.22 * w, -0.06 * w, 0.2 * w, 0.17 * w, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8d6c33';
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo((-0.22 + i * 0.05) * w, -0.06 * w);
        ctx.lineTo((-0.22 + i * 0.032) * w, -0.2 * w);
        ctx.stroke();
      }
      ctx.fillStyle = '#3f6073';
      ctx.beginPath();
      ctx.ellipse(0.2 * w, -0.15 * w, 0.06 * w, 0.09 * w, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(0.21 * w, -0.265 * w, 0.04 * w, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#e3c37a';
      ctx.beginPath();
      ctx.moveTo(0.08 * w, -0.285 * w);
      ctx.lineTo(0.215 * w, -0.395 * w);
      ctx.lineTo(0.35 * w, -0.285 * w);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b8964a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0.08 * w, -0.285 * w);
      ctx.lineTo(0.35 * w, -0.285 * w);
      ctx.stroke();
      ctx.strokeStyle = '#2a1d17';
      ctx.lineWidth = Math.max(1.4, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(0.25 * w, -0.17 * w);
      ctx.lineTo(0.66 * w, -0.41 * w);
      ctx.stroke();
      if (!refl) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0.66 * w, -0.41 * w);
        ctx.quadraticCurveTo(0.72 * w, -0.2 * w, 0.69 * w, 0.035 * w);
        ctx.stroke();
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath();
        ctx.arc(0.69 * w, 0.035 * w, 0.012 * w, 0, 6.3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.45)';
        for (let k = 0; k < 3; k++) {
          const ph = rm ? k / 3 : (time * 0.5 + k / 3) % 1;
          ctx.globalAlpha = (1 - ph) * 0.7;
          ctx.beginPath();
          ctx.ellipse(
            0.69 * w,
            0.04 * w,
            (0.02 + ph * 0.08) * w,
            (0.006 + ph * 0.02) * w,
            0,
            0,
            6.3,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#2a1d17';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-0.47 * w, -0.13 * w);
      ctx.lineTo(-0.47 * w, -0.25 * w);
      ctx.stroke();
      ctx.fillStyle = '#8a5a35';
      ctx.fillRect(-0.495 * w, -0.31 * w, 0.05 * w, 0.06 * w);
      if (lightsOn > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(-0.47 * w, -0.28 * w, 0.12 * w, [255, 190, 110], 0.8 * lightsOn);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawPavilion = (x: number, y: number, w: number, refl: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      if (refl) ctx.scale(1, -0.8);
      const dark = '#080c18';
      ctx.fillStyle = dark;
      ctx.fillRect(-0.6 * w, -0.015 * w, 2.1 * w, 0.035 * w);
      for (let i = -2; i <= 7; i++) {
        ctx.fillRect((i * 0.2 - 0.012) * w, 0, 0.024 * w, 0.12 * w);
      }
      ctx.fillRect(0, -0.28 * w, 0.8 * w, 0.26 * w);
      ctx.fillStyle = `rgba(255,${(180 + 30 * lightsOn) | 0},100,${
        0.1 + 0.88 * lightsOn
      })`;
      for (const px of [0.07, 0.31, 0.55]) {
        ctx.fillRect(px * w, -0.22 * w, 0.17 * w, 0.12 * w);
      }
      ctx.fillStyle = dark;
      ctx.fillRect(0.16 * w, -0.22 * w, 0.008 * w, 0.12 * w);
      ctx.fillRect(0.4 * w, -0.22 * w, 0.008 * w, 0.12 * w);
      ctx.fillRect(0.64 * w, -0.22 * w, 0.008 * w, 0.12 * w);
      ctx.beginPath();
      for (const [a, b] of [
        [-0.16, -0.33],
        [-0.04, -0.31],
        [0.08, -0.42],
        [0.72, -0.42],
        [0.84, -0.31],
        [0.96, -0.33],
        [0.86, -0.28],
        [-0.06, -0.28],
      ]) {
        ctx.lineTo(a * w, b * w);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-0.02 * w, -0.1 * w, 0.84 * w, 0.012 * w);
      {
        const fx = 1.1 * w;
        const fy = -0.015 * w;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(1.7, 1.7);
        ctx.translate(-fx, -fy);
        ctx.fillStyle = '#1b2740';
        ctx.beginPath();
        ctx.ellipse(fx, fy - 0.055 * w, 0.032 * w, 0.06 * w, 0, 0, 6.3);
        ctx.fill();
        ctx.strokeStyle = '#1b2740';
        ctx.lineWidth = 0.024 * w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(fx, fy - 0.012 * w);
        ctx.lineTo(fx + 0.045 * w, fy - 0.01 * w);
        ctx.lineTo(fx + 0.05 * w, fy + 0.045 * w);
        ctx.stroke();
        ctx.fillStyle = '#c99a72';
        ctx.beginPath();
        ctx.arc(fx + 0.004 * w, fy - 0.135 * w, 0.03 * w, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = '#cfa95e';
        ctx.beginPath();
        ctx.moveTo(fx - 0.05 * w, fy - 0.15 * w);
        ctx.lineTo(fx + 0.004 * w, fy - 0.215 * w);
        ctx.lineTo(fx + 0.058 * w, fy - 0.15 * w);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(fx - 0.1 * w, fy - 0.045 * w, 0.04 * w, 0.045 * w);
        if (lightsOn > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(
            fx - 0.08 * w,
            fy - 0.025 * w,
            0.09 * w,
            [255, 190, 110],
            0.8 * lightsOn,
          );
          ctx.restore();
        }
        ctx.restore();
      }
      if (lightsOn > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(0.4 * w, -0.16 * w, 0.6 * w, [255, 170, 90], 0.4 * lightsOn);
        for (let i = 0; i < 9; i++) {
          const bx = (0.0 + i * 0.11) * w;
          const by = -0.3 * w + Math.sin((i / 8) * Math.PI) * 0.04 * w;
          glow(bx, by, 0.05 * w, [255, 210, 140], 0.9 * lightsOn);
          ctx.fillStyle = `rgba(255,230,170,${lightsOn})`;
          ctx.fillRect(bx - 1, by - 1, 2, 2);
        }
        ctx.restore();
      }
      ctx.restore();
    };

    const gy = (wx: number) =>
      lerp(H * 1.1, H * 0.8, smoothstep(2.5, 3, wx)) -
      H * 0.05 * smoothstep(3, 3.8, wx) +
      H * 0.012 * Math.sin(wx * 7 + 1) * smoothstep(2.8, 3.2, wx);

    const hillY = (wx: number) =>
      HOR +
      H * 0.05 +
      Math.sin(wx * 3.1 + 1) * H * 0.018 +
      Math.sin(wx * 7.3) * H * 0.008 +
      (1 - smoothstep(2.2, 2.8, wx)) * H * 0.3;

    const drawHill = () => {
      if (tc < 1.8) return;
      const c = mixRgb(col('grass'), [0, 0, 0], 0.3);
      ctx.fillStyle = rgbCss(c);
      ctx.beginPath();
      ctx.moveTo(-10, H + 5);
      for (let x = -10; x <= W + 10; x += 6) {
        const wx = tc + (x / W - 0.5) / 0.7;
        ctx.lineTo(x, hillY(wx));
      }
      ctx.lineTo(W + 10, H + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgbCss(mixRgb(c, [0, 0, 0], 0.15));
      for (const p of pines) {
        const x = sx(p.wx, 0.7);
        const y = hillY(p.wx) + 2;
        const h = p.h * H;
        const w = h * 0.45 * p.w;
        if (x < -30 || x > W + 30 || y > H) continue;
        for (let t = 0; t < 3; t++) {
          const yy = y - h * (t * 0.3);
          const ww = w * (1 - t * 0.22);
          ctx.beginPath();
          ctx.moveTo(x - ww, yy);
          ctx.lineTo(x, yy - h * 0.5);
          ctx.lineTo(x + ww, yy);
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    const drawMeadow = (time: number) => {
      if (tc < 1.9) return;
      const c1 = col('grass');
      const c2 = col('grass2');
      const g = ctx.createLinearGradient(0, H * 0.65, 0, H);
      g.addColorStop(0, rgbCss(c1));
      g.addColorStop(1, rgbCss(c2));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, H + 5);
      for (let x = -10; x <= W + 10; x += 6) {
        ctx.lineTo(x, gy(tc + (x / W - 0.5)));
      }
      ctx.lineTo(W + 10, H + 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(150,175,230,${0.22 * night})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 6) {
        const y = gy(tc + (x / W - 0.5));
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const step = 8 / W;
      const k0 = Math.floor((tc - 0.55) / step);
      const k1 = Math.ceil((tc + 0.55) / step);
      ctx.strokeStyle = rgbCss(mixRgb(c1, [60, 90, 80], 0.25));
      ctx.lineCap = 'round';
      for (let k = k0; k <= k1; k++) {
        const wx = k * step;
        const y = gy(wx);
        if (y > H) continue;
        const x = W * (0.5 + (wx - tc));
        const h = (0.012 + hsh(k) * 0.03) * H;
        const lean =
          (hsh(k + 99) - 0.5) * 0.5 * h +
          (rm ? 0 : Math.sin(time * 1.3 + k * 0.37) * 0.18 * h);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.55, x + lean, y - h);
        ctx.stroke();
      }
    };

    const drawVan = (x: number, y: number, w: number) => {
      const u = w / 100;
      const lit = lightsOn;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(u, u);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 56, 4, 0, 0, 6.3);
      ctx.fill();
      if (lit > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(50, -13, 170, -4);
        g.addColorStop(0, `rgba(255,230,160,${0.5 * lit})`);
        g.addColorStop(1, 'rgba(255,230,160,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(50, -15);
        ctx.lineTo(190, -34);
        ctx.lineTo(200, 6);
        ctx.lineTo(50, -9);
        ctx.closePath();
        ctx.fill();
        glow(-17, -32, 60, [255, 190, 110], 0.28 * lit);
        ctx.restore();
      }
      const body = new Path2D();
      body.moveTo(-50, -8);
      body.lineTo(-50, -34);
      body.quadraticCurveTo(-50, -45, -39, -45);
      body.lineTo(17, -45);
      body.quadraticCurveTo(25, -45, 30, -38);
      body.lineTo(44, -23);
      body.quadraticCurveTo(50, -18, 50, -12);
      body.lineTo(50, -8);
      body.closePath();
      ctx.fillStyle = '#9fb3be';
      ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      ctx.fillStyle = '#2b6a72';
      ctx.fillRect(-52, -22, 104, 16);
      const sh = ctx.createLinearGradient(0, -45, 0, -6);
      sh.addColorStop(0, 'rgba(10,20,50,.05)');
      sh.addColorStop(1, 'rgba(10,20,50,.42)');
      ctx.fillStyle = sh;
      ctx.fillRect(-52, -46, 104, 40);
      ctx.restore();
      ctx.strokeStyle = 'rgba(225,235,255,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-38, -45);
      ctx.lineTo(17, -45);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,205,120,${0.3 + 0.68 * lit})`;
      ctx.beginPath();
      ctx.moveTo(-42, -37);
      ctx.lineTo(5, -37);
      ctx.lineTo(5, -26);
      ctx.lineTo(-42, -26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(20,30,50,.55)';
      ctx.fillRect(-18, -37, 1.6, 11);
      ctx.fillStyle = 'rgba(120,160,190,.55)';
      ctx.beginPath();
      ctx.moveTo(13, -38);
      ctx.lineTo(22, -38);
      ctx.lineTo(35, -26);
      ctx.lineTo(13, -26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(8, -44);
      ctx.lineTo(8, -9);
      ctx.stroke();
      ctx.strokeStyle = '#26323c';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-40, -46.5);
      ctx.lineTo(12, -46.5);
      ctx.moveTo(-36, -46.5);
      ctx.lineTo(-36, -45);
      ctx.moveTo(6, -46.5);
      ctx.lineTo(6, -45);
      ctx.stroke();

      ctx.strokeStyle = '#26354a';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -48);
      ctx.lineTo(-2, -50);
      ctx.lineTo(1, -46);
      ctx.stroke();
      ctx.fillStyle = '#2f4560';
      ctx.beginPath();
      ctx.ellipse(-12, -55, 4, 7, 0.35, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = '#2f4560';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, -58);
      ctx.lineTo(-3, -68);
      ctx.stroke();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(-9.5, -65, 3.4, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#d9663f';
      ctx.beginPath();
      ctx.arc(-9.5, -66, 3.7, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a5a35';
      ctx.fillRect(7, -52, 5, 6);
      ctx.fillStyle = `rgba(255,207,122,${0.4 + 0.6 * lit})`;
      ctx.fillRect(7.8, -51.2, 3.4, 4.4);
      ctx.fillStyle = '#0a1118';
      for (const wx of [-30, 32]) {
        ctx.beginPath();
        ctx.arc(wx, -8, 11, Math.PI, 0);
        ctx.fill();
      }
      for (const wx of [-30, 32]) {
        ctx.fillStyle = '#10171d';
        ctx.beginPath();
        ctx.arc(wx, -8, 8.5, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = '#9aa7ae';
        ctx.beginPath();
        ctx.arc(wx, -8, 4, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = '#10171d';
        ctx.beginPath();
        ctx.arc(wx, -8, 1.4, 0, 6.3);
        ctx.fill();
      }
      ctx.fillStyle = '#7d8b93';
      ctx.fillRect(-53, -12, 5, 4);
      ctx.fillRect(47, -12, 6, 4);
      ctx.fillStyle = '#e04a3d';
      ctx.beginPath();
      ctx.arc(-49.5, -18, 1.8, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,190,${0.6 + 0.4 * lit})`;
      ctx.beginPath();
      ctx.arc(49, -17, 3.2, 0, 6.3);
      ctx.fill();
      if (lit > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(49, -17, 24, [255, 235, 170], 0.6 * lit);
        glow(9.5, -49, 12, [255, 200, 120], 0.7 * lit);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawFG = (time: number) => {
      const f = 1.25;
      const step = 11 / (W * f);
      const k0 = Math.floor((tc - 0.5 / f - 0.05) / step);
      const k1 = Math.ceil((tc + 0.5 / f + 0.05) / step);
      const c = col('grass2');
      ctx.lineCap = 'round';
      for (let k = k0; k <= k1; k++) {
        const wx = k * step;
        const a = smoothstep(2.7, 3, wx);
        if (a < 0.02) continue;
        const x = W * (0.5 + (wx - tc) * f) + mxs * W * 0.05;
        const h = (0.05 + hsh(k * 3.1) * 0.15) * H;
        const lean =
          (hsh(k + 7) - 0.5) * 0.1 * h +
          (rm ? 0 : Math.sin(time * 1.3 + k * 0.37) * 0.035 * h);
        ctx.strokeStyle = rgbCss(
          mixRgb(c, [20, 40, 50], hsh(k + 3) * 0.5),
          a,
        );
        ctx.lineWidth = 2.2 + hsh(k + 5) * 2;
        ctx.beginPath();
        ctx.moveTo(x, H + 4);
        ctx.quadraticCurveTo(x + lean * 0.3, H - h * 0.55, x + lean, H - h);
        ctx.stroke();
      }
    };

    const drawReeds = (time: number) => {
      const c = col('reed');
      ctx.lineCap = 'round';
      for (const r of reeds) {
        const x = sx(r.wx, 1.3);
        if (x < -40 || x > W + 40) continue;
        const a = 1 - smoothstep(2.55, 2.95, r.wx);
        if (a < 0.02) continue;
        const base = H + 4 - r.dy * H;
        const h = r.h * H;
        const sw = rm ? 0 : Math.sin(time * 1.1 + r.ph) * h * 0.04;
        const tx = x + r.lean * h + sw;
        const ty = base - h;
        ctx.globalAlpha = a;
        ctx.strokeStyle = rgbCss(c);
        ctx.lineWidth = Math.max(1.5, h * 0.018);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(
          x + r.lean * h * 0.6 + sw * 0.5,
          base - h * 0.55,
          tx,
          ty,
        );
        ctx.stroke();
        if (r.head) {
          ctx.fillStyle = rgbCss(mixRgb(c, [90, 55, 35], 0.5));
          ctx.beginPath();
          ctx.ellipse(tx, ty + h * 0.05, h * 0.022, h * 0.07, r.lean, 0, 6.3);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawFlies = (time: number) => {
      const a0 = smoothstep(1.5, 2.2, tc);
      if (a0 < 0.02) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const t = rm ? 0 : time * f.sp;
        const x =
          ((((f.x + Math.sin(t + f.ph) * 0.04 - tc * 0.05 + mxs * 0.03) % 1) +
            1) %
            1) *
          W;
        const y = (f.y + Math.cos(t * 1.3 + f.ph) * 0.03) * H;
        const a = a0 * (rm ? 0.6 : 0.4 + 0.6 * Math.sin(time * 1.7 + f.ph) ** 2);
        glow(x, y, f.r * 7, [255, 225, 140], 0.5 * a);
      }
      ctx.restore();
    };

    const drawMist = (
      time: number,
      mistIntensity: number,
      fogElevation: number,
    ) => {
      if (mistIntensity < 0.03) return;
      const baseColor = mixRgb(
        mixRgb([238, 248, 255], [255, 214, 182], sunsetK),
        [156, 182, 228],
        night,
      );
      const bandCenterY = lerp(HOR + H * 0.015, H * 0.8, fogElevation);
      const span = W * 1.5;

      ctx.save();
      for (const m of mistLayers) {
        const drift = rm ? 0 : time * m.sp * W;
        const x =
          ((((W * (0.5 + (m.wx - tc) * 0.65) + drift + mxs * W * 0.025) %
            span) +
            span) %
            span) -
          W * 0.25;
        const y =
          bandCenterY +
          m.yOff * H +
          (rm ? 0 : Math.sin(time * 0.35 + m.ph) * H * 0.012);
        const rx = Math.max(120, W * m.rx);
        const ry = Math.max(22, H * m.ry);
        const alpha = mistIntensity * m.a * (night > 0.5 ? 0.22 : 0.26);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, ry / rx);
        const grad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
        grad.addColorStop(0, rgbCss(baseColor, alpha));
        grad.addColorStop(0.55, rgbCss(baseColor, alpha * 0.45));
        grad.addColorStop(1, rgbCss(baseColor, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, 6.2832);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawRain = (time: number, rainIntensity: number) => {
      if (rainIntensity < 0.03) return;
      const rainColor = mixRgb(
        mixRgb([224, 240, 255], [255, 220, 186], sunsetK),
        [192, 214, 248],
        night,
      );
      const activeCount = Math.floor(rainDrops.length * clamp(rainIntensity, 0, 1));
      const slantX = -0.14;
      const waterSurfaceRatio = clamp(1 - smoothstep(2.3, 2.8, tc), 0, 1);

      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < activeCount; i++) {
        const d = rainDrops[i];
        const fall = rm ? 0 : time * d.sp;
        const x =
          ((((d.x + fall * slantX * 0.5 - tc * 0.18 + mxs * 0.02) % 1) + 1) %
            1) *
          W;
        const ny = (d.y + fall) % 1;
        const y = ny * H;
        const len = d.len * (0.7 + 0.5 * rainIntensity);
        const alpha = d.a * (0.18 + 0.34 * rainIntensity);

        ctx.strokeStyle = rgbCss(rainColor, alpha);
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len * slantX, y + len);
        ctx.stroke();

        // Subtle expanding rain splash rings on the lake surface
        if (!rm && waterSurfaceRatio > 0.05 && d.splashSeed < 0.35) {
          const splashPhase = (time * d.sp * 1.4 + d.splashSeed * 10) % 1;
          const sxPos =
            ((((d.x * 1.13 - tc * 0.35) % 1) + 1) % 1) * W;
          const syPos = HOR + 10 + d.splashSeed * (H - HOR - 24);
          const radiusX = 3 + splashPhase * 11;
          const radiusY = 1 + splashPhase * 3.2;
          ctx.strokeStyle = rgbCss(
            rainColor,
            (1 - splashPhase) * 0.28 * rainIntensity * waterSurfaceRatio,
          );
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(sxPos, syPos, radiusX, radiusY, 0, 0, 6.2832);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const draw = (time: number, dt: number) => {
      night = smoothstep(1.05, 1.9, tc);
      sunsetK = 1 - clamp(Math.abs(tc - 1) / 0.6, 0, 1);
      lightsOn = smoothstep(1.2, 2, tc);

      const s = drawSky(time);
      if (rm) {
        if (tc > 2.5) {
          drawComet(getFrozenComet());
        }
      } else {
        for (const c of comets) {
          stepComet(c, dt);
          drawComet(c);
        }
        for (let i = comets.length - 1; i >= 0; i--) {
          if (comets[i].life > comets[i].max) comets.splice(i, 1);
        }
      }

      mtn('farMtn', 0.25, H * 0.17, 1.3, 1.4);
      mtn('midMtn', 0.4, H * 0.085, 4.1, 3.2);
      const hor = col('skyHor');
      const mg = ctx.createLinearGradient(0, HOR - H * 0.07, 0, HOR + H * 0.01);
      mg.addColorStop(0, rgbCss(hor, 0));
      mg.addColorStop(1, rgbCss(hor, 0.55));
      ctx.fillStyle = mg;
      ctx.fillRect(0, HOR - H * 0.07, W, H * 0.08);
      drawWater();

      const vis =
        clamp((HOR + s.sunR * 0.5 - s.sunY) / (s.sunR * 3), 0, 1) *
        (tc < 1.8 ? 1 : 0);
      glint(s.sunX, vis * 0.7, s.sunC, time, 1);
      const moonA = smoothstep(1.7, 2.4, tc);
      glint(
        W * 0.8 + mxs * W * 0.012,
        moonA * 0.5,
        [235, 235, 255],
        time,
        0.8,
      );
      if (night > 0.3) {
        ctx.fillStyle = `rgba(255,250,235,${0.5 * night})`;
        for (let i = 0; i < 40; i++) {
          const x = hsh(i) * W;
          const y = HOR + 8 + hsh(i + 50) * (H - HOR) * 0.9;
          const t = rm ? 0.7 : 0.5 + 0.5 * Math.sin(time * 1.4 + i);
          if (t > 0.6) ctx.fillRect(x, y, 1.5, 1);
        }
      }

      const ix = sx(1, 1);
      const by = HOR + 0.045 * H;
      if (ix > -3 * R && ix < W + 3 * R) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        drawIsland(ix, by + 2, R, true);
        ctx.restore();
      }
      const bw = Math.max(150, U * 0.2);
      const bx = sx(0.12, 1);
      const byy = HOR + 0.17 * H;
      if (bx > -bw && bx < W + bw) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        drawBoat(bx, byy + bw * 0.05, bw, true, time);
        ctx.restore();
      }
      const pw = Math.max(190, U * 0.18);
      const px = sx(1.56, 1);
      const py = HOR + 0.2 * H;
      if (px > -pw * 2 && px < W + pw) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        drawPavilion(px, py + pw * 0.02, pw, true);
        ctx.restore();
      }

      drawTownLights(time);
      drawRipples(time);
      if (ix > -3 * R && ix < W + 3 * R) drawIsland(ix, by, R, false);
      if (bx > -bw && bx < W + bw) drawBoat(bx, byy, bw, false, time);
      if (px > -pw * 2 && px < W + pw) drawPavilion(px, py, pw, false);

      drawHill();
      drawMeadow(time);
      const vw = Math.max(200, U * 0.22);
      const vwx = 3.12;
      const vx = sx(vwx, 1);
      if (tc > 1.9 && vx > -vw && vx < W + vw) {
        drawVan(vx, gy(vwx) + vw * 0.05, vw);
      }
      const weather = computeWeatherState(tc);
      drawMist(time, weather.mistIntensity, weather.fogElevation);
      drawFG(time);
      drawReeds(time);
      drawRain(time, weather.rainIntensity);
      drawFlies(time);

      anchor[0] = { x: bx + 0.21 * bw, y: byy - 0.42 * bw };
      anchor[1] = { x: ix - 0.38 * R, y: by - 2.36 * R };
      anchor[2] = { x: px + 1.1 * pw + 0.004 * pw, y: py - 0.4 * pw };
      anchor[3] = {
        x: vx - 9.5 * (vw / 100),
        y: gy(vwx) + vw * 0.05 - 72 * (vw / 100),
      };
    };

    let lastClock = '';
    let lastShadow = '';
    let lastDot = -1;
    let lastBearing = '';
    let lastHeadingAttr = '';
    let lastSchemeAttr = '';
    let lastDimAttr = '';
    let compassDeg = 65;

    const updateDomUi = () => {
      const palette = computeUiPalette(tc);
      root.style.setProperty('--ink', rgbCss(palette.ink));
      root.style.setProperty('--inv', rgbCss(palette.inv));
      root.style.setProperty('--em', rgbCss(palette.em));
      root.style.setProperty('--btn-bg', rgbCss(palette.btnBg));
      root.style.setProperty('--btn-ink', rgbCss(palette.btnInk));
      root.style.setProperty(
        '--btn-border-alpha',
        palette.btnBorderAlpha.toFixed(3),
      );
      root.style.setProperty('--say-bg', rgbCss(palette.sayBg, 0.96));
      root.style.setProperty('--say-ink', rgbCss(palette.sayInk));
      root.style.setProperty('--say-em', rgbCss(palette.sayEm));
      root.style.setProperty('--hud-alpha', palette.hudAlpha.toFixed(3));

      if (palette.scheme !== lastSchemeAttr) {
        lastSchemeAttr = palette.scheme;
        root.setAttribute('data-ui-scheme', palette.scheme);
      }
      const dimAttr = palette.dimFactor.toFixed(2);
      if (dimAttr !== lastDimAttr) {
        lastDimAttr = dimAttr;
        root.setAttribute('data-dim-factor', dimAttr);
      }

      const sh = tc > 0.8 ? '0 2px 26px rgba(4,10,30,.5)' : 'none';
      if (sh !== lastShadow) {
        root.style.setProperty('--tsh', sh);
        lastShadow = sh;
      }

      sceneRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.abs(tc - i);
        const op = 1 - smoothstep(0.22, 0.5, d);
        el.style.opacity = op.toFixed(3);
        el.style.visibility = op < 0.03 ? 'hidden' : 'visible';
        const copyEl = el.querySelector('.copy') as HTMLElement | null;
        if (copyEl) {
          copyEl.style.transform = `translateY(${((i - tc) * 60).toFixed(1)}px)`;
        }
      });

      const hud = computeHudReadout(tc);
      if (hud.clock !== lastClock) {
        lastClock = hud.clock;
        if (clockElRef.current) clockElRef.current.textContent = hud.clock;
        if (tempElRef.current) tempElRef.current.textContent = hud.tempText;
      }

      if (compassNeedleRef.current) {
        compassNeedleRef.current.style.transform = `rotate(${compassDeg.toFixed(2)}deg)`;
      }
      const bearing = formatBearing(compassDeg);
      if (bearing.bearingText !== lastBearing) {
        lastBearing = bearing.bearingText;
        if (compassBearingRef.current) {
          compassBearingRef.current.textContent = bearing.bearingText;
        }
      }
      const headingAttr = String(bearing.normalizedDeg);
      if (headingAttr !== lastHeadingAttr) {
        lastHeadingAttr = headingAttr;
        if (compassElRef.current) {
          compassElRef.current.setAttribute('data-heading', headingAttr);
          compassElRef.current.setAttribute('data-cardinal', bearing.cardinal);
        }
      }

      if (hud.stopIndex !== lastDot) {
        lastDot = hud.stopIndex;
        dotRefs.current.forEach((d, j) => {
          if (d) d.classList.toggle('on', j === hud.stopIndex);
        });
      }

      if (hintElRef.current) {
        hintElRef.current.style.opacity = String(1 - smoothstep(0.04, 0.25, tc));
      }
    };

    let vs = -1;
    let vl = 0;
    let vc = 0;
    let vacc = 0;
    let vwait = 0;
    let vw0 = 0;
    let vh0 = 0;
    let vlast = -1;
    let vdone = false;
    const CPS = 0.042;

    const measureSay = () => {
      const sayEl = sayElRef.current;
      if (!sayEl) return;
      vw0 = sayEl.offsetWidth;
      vh0 = sayEl.offsetHeight;
    };

    const setSay = () => {
      const sayEl = sayElRef.current;
      if (!sayEl || vs < 0) return;
      const sayT = sayEl.querySelector('.t');
      const sayR = sayEl.querySelector('.r');
      const sayC = sayEl.querySelector('.car') as HTMLElement | null;
      const line = ALFAN_LINES[vs][vl];
      if (sayT) sayT.textContent = line.slice(0, vc);
      if (sayR) sayR.textContent = line.slice(vc);
      if (sayC) sayC.style.display = rm || vdone ? 'none' : 'inline-block';
      measureSay();
    };

    const updateVoice = (dt: number) => {
      const sayEl = sayElRef.current;
      if (!sayEl) return;
      const i = Math.round(tc);
      const d = Math.abs(tc - i);
      if (i !== vs) {
        vs = i;
        vl = 0;
        vc = 0;
        vacc = 0;
        vwait = -0.7;
        vdone = false;
        vlast = -1;
        setSay();
      }
      const line = ALFAN_LINES[vs][vl];
      if (vwait < 0) {
        vwait += dt;
      } else if (vc < line.length) {
        if (rm) vc = line.length;
        else {
          vacc += dt;
          while (vacc >= CPS && vc < line.length) {
            vacc -= CPS;
            vc++;
          }
        }
        if (vc === line.length) vwait = 0;
      } else {
        vwait += dt;
        if (
          vwait > 1.3 + line.length * 0.035 &&
          vl < ALFAN_LINES[vs].length - 1
        ) {
          vl++;
          vc = 0;
          vacc = 0;
          vwait = 0;
          vlast = -1;
        } else if (vl === ALFAN_LINES[vs].length - 1 && !vdone) {
          vdone = true;
          vlast = -1;
        }
      }
      if (vc !== vlast) {
        vlast = vc;
        setSay();
      }
      const a = anchor[vs];
      const op = (vc > 0 ? 1 : 0) * (1 - smoothstep(0.18, 0.4, d));
      sayEl.style.opacity = op.toFixed(3);
      if (a) {
        const x = clamp(a.x - vw0 / 2, 12, W - vw0 - 12);
        const y = Math.max(a.y - vh0 - 12, 64);
        sayEl.style.setProperty('--tx', `${clamp(a.x - x, 18, vw0 - 18)}px`);
        sayEl.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      }
    };

    const syncScrollTarget = () => {
      const track = trackRef.current;
      if (!track) return;
      const max = track.offsetHeight - window.innerHeight;
      target = max > 0 ? clamp(window.scrollY / max, 0, 1) * 3 : 0;
    };

    const handleScroll = () => {
      syncScrollTarget();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') {
        mxT = e.clientX / Math.max(W, 1) - 0.5;
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (night < 0.3) return;
      spawnComet(tc > 2.4, e.clientX, e.clientY, 0.2 + Math.random() * 0.5);
    };

    const handleResize = () => {
      resize();
      syncScrollTarget();
      measureSay();
    };

    resize();
    syncScrollTarget();
    tc = target;
    compassDeg = computeCompassState(tc, 0).headingDeg;

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    cv.addEventListener('click', handleCanvasClick);

    let rafId = 0;
    let last = performance.now();
    let time = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;

      tc += (target - tc) * (1 - Math.exp(-dt * (rm ? 30 : 5)));
      tc = clamp(tc, 0, 3);
      mxs += (mxT - mxs) * (1 - Math.exp(-dt * 4));
      if (rm) mxs = 0;

      const steerBias = rm ? 0 : clamp((target - tc) * 1.4, -1, 1);
      const compassTarget = computeCompassState(tc, steerBias).headingDeg;
      compassDeg += (compassTarget - compassDeg) * (1 - Math.exp(-dt * (rm ? 30 : 2.6)));

      autoSpawn(dt);
      draw(time, dt);
      updateDomUi();
      updateVoice(dt);

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cv.removeEventListener('click', handleCanvasClick);
    };
  }, [
    clockElRef,
    compassBearingRef,
    compassElRef,
    compassNeedleRef,
    dotRefs,
    hintElRef,
    sayElRef,
    sceneRefs,
    tempElRef,
    trackRef,
  ]);

  return (
    <canvas
      ref={canvasRef}
      id="c"
      data-testid="panorama-canvas"
      aria-hidden="true"
    />
  );
}
