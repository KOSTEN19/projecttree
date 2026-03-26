import React, { useEffect, useRef } from "react";

const N_DOTS = 96;

/** Грубые контуры материков (широта, долгота) — декоративная сетка на сфере */
const COAST_LINES = [
  [[72, -165], [68, -168], [60, -140], [55, -130], [49, -125], [42, -125], [37, -122], [32, -117], [25, -110], [18, -95], [12, -87]],
  [[50, -128], [45, -95], [42, -82], [40, -74], [35, -76], [30, -85], [25, -80], [18, -66]],
  [[14, -92], [10, -85], [6, -52], [0, -48], [-8, -35], [-18, -40], [-25, -48], [-35, -55], [-45, -62], [-52, -70]],
  [[36, -10], [37, 0], [35, 8], [32, -6], [28, -14], [43, 3], [50, 5]],
  [[37, -8], [32, -6], [28, 2], [20, -17], [15, -17], [10, 0], [5, 12], [0, 15], [-8, 12], [-18, 20], [-28, 32], [-34, 18]],
  [[40, 44], [38, 50], [35, 58], [30, 48], [25, 35], [22, 28], [28, 20], [35, 25], [42, 40]],
  [[50, 100], [45, 125], [35, 120], [28, 108], [22, 88], [20, 77], [28, 72], [38, 75], [48, 95], [52, 118]],
  [[20, 72], [12, 80], [8, 98], [6, 110], [18, 118], [28, 102]],
  [[-10, 115], [-15, 125], [-22, 135], [-30, 150], [-38, 145], [-42, 128], [-35, 118]],
  [[-20, -180], [-22, -175], [-25, -150], [-30, -120], [-35, -100], [-40, -75], [-48, -65], [-52, -70], [-55, -90]],
];

function project(latDeg, lonDeg, rotYDeg, cx, cy, R) {
  const phi = (latDeg * Math.PI) / 180;
  const theta = ((lonDeg + rotYDeg) * Math.PI) / 180;
  const x3 = Math.cos(phi) * Math.sin(theta);
  const y3 = Math.sin(phi);
  const z3 = Math.cos(phi) * Math.cos(theta);
  if (z3 < -0.12) return null;
  return { x: cx + x3 * R, y: cy - y3 * R, z: z3 };
}

export default function HomeGlobeBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const dots = Array.from({ length: N_DOTS }, () => ({
      lat: (Math.random() - 0.5) * 150,
      lon: Math.random() * 360,
      phase: Math.random() * Math.PI * 2,
      freq: 0.7 + Math.random() * 2.2,
      r: 0.55 + Math.random() * 1.35,
    }));

    let raf = 0;
    /** @type {{ ax: number, ay: number, bx: number, by: number, t0: number, dur: number }[]} */
    let rockets = [];
    let lastSpawn = 0;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceMotion = () => mq.matches;

    const frame = (t) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rotY = (t * 0.01) % 360;
      const cx = w * 0.68;
      const cy = h * 0.4;
      const R = Math.min(w, h) * 0.36;

      const halo = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.45);
      halo.addColorStop(0, "rgba(56, 100, 180, 0.22)");
      halo.addColorStop(0.45, "rgba(24, 40, 80, 0.12)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const ball = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.08, cx, cy, R);
      ball.addColorStop(0, "rgba(110, 160, 230, 0.2)");
      ball.addColorStop(0.55, "rgba(35, 55, 100, 0.45)");
      ball.addColorStop(1, "rgba(6, 10, 24, 0.75)");
      ctx.fillStyle = ball;
      ctx.fill();
      ctx.strokeStyle = "rgba(130, 170, 220, 0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();

      /* Контуры материков */
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const seg of COAST_LINES) {
        ctx.beginPath();
        let started = false;
        for (const [lat, lon] of seg) {
          const p = project(lat, lon, rotY, cx, cy, R);
          if (!p || p.z < 0.02) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        if (started) {
          ctx.strokeStyle = "rgba(140, 185, 235, 0.11)";
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      const time = t * 0.001;
      const projectedDots = [];

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const p = project(d.lat, d.lon, rotY, cx, cy, R);
        if (!p) continue;
        projectedDots.push({ i, p, d });
        const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * d.freq + d.phase));
        const depth = (p.z + 1) * 0.5;
        const alpha = twinkle * (0.2 + 0.8 * depth);

        ctx.beginPath();
        ctx.arc(p.x, p.y, d.r * (0.75 + 0.25 * depth), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, d.r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 210, 255, ${alpha * 0.12})`;
        ctx.fill();
      }

      /* «Ракеты»: линии между точками, растут и гаснут */
      if (!reduceMotion() && projectedDots.length > 2) {
        if (rockets.length < 16 && t - lastSpawn > 120 && Math.random() < 0.055) {
          const vis = projectedDots.filter((x) => x.p.z > 0.08);
          if (vis.length >= 2) {
            const a = vis[Math.floor(Math.random() * vis.length)];
            let b = a;
            for (let n = 0; n < 20 && b.i === a.i; n++) {
              b = vis[Math.floor(Math.random() * vis.length)];
            }
            if (b.i !== a.i) {
              rockets.push({
                ax: a.p.x,
                ay: a.p.y,
                bx: b.p.x,
                by: b.p.y,
                t0: t,
                dur: 480 + Math.random() * 700,
              });
              lastSpawn = t;
            }
          }
        }

        rockets = rockets.filter((r) => {
          const u = (t - r.t0) / r.dur;
          if (u >= 1) return false;
          const head = u * u * (3 - 2 * u);
          const hx = r.ax + (r.bx - r.ax) * head;
          const hy = r.ay + (r.by - r.ay) * head;
          const trail = Math.sin(Math.PI * u);
          const alpha = trail * 0.95;

          ctx.beginPath();
          ctx.moveTo(r.ax, r.ay);
          ctx.lineTo(hx, hy);
          const g = ctx.createLinearGradient(r.ax, r.ay, hx, hy);
          g.addColorStop(0, `rgba(140, 190, 255, ${alpha * 0.2})`);
          g.addColorStop(0.45, `rgba(220, 240, 255, ${alpha * 0.85})`);
          g.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.5})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1 + (1 - u) * 1.4;
          ctx.lineCap = "round";
          ctx.shadowBlur = 10;
          ctx.shadowColor = `rgba(180, 220, 255, ${alpha * 0.45})`;
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.arc(hx, hy, 2.2 * (1 - u) + 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
          ctx.fill();

          return true;
        });
      } else {
        rockets = [];
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
