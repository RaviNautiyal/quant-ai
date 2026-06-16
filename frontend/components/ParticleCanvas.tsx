"use client";

import { useEffect, useRef } from "react";

const UP = "#3dba6a";
const DN = "#e05555";

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const labels = labelsRef.current!;
    const ctx    = canvas.getContext("2d")!;

    let W = 0, H = 0, frame = 0, raf = 0;
    let mouse = { x: -999, y: -999 };
    const dpr = window.devicePixelRatio || 1;
    const floaters: { el: HTMLDivElement; life: number }[] = [];

    interface P {
      x: number; y: number; z: number;
      vx: number; vy: number; r: number;
      up: boolean; age: number; life: number;
      pulse: number; burst: boolean;
    }

    let particles: P[] = [];
    let chart: { x: number; y: number }[] = [];

    /* ── resize ───────────────────────────────────────────────── */
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      buildChart();
    }

    /* ── background chart line ───────────────────────────────── */
    function buildChart() {
      chart = [];
      let v = H * 0.55;
      for (let i = 0; i <= 100; i++) {
        v += (Math.random() - 0.47) * 8;
        v  = Math.max(H * 0.15, Math.min(H * 0.85, v));
        chart.push({ x: (i / 100) * W, y: v });
      }
    }

    /* ── particle factory ────────────────────────────────────── */
    function mkP(x?: number, y?: number, burst?: boolean): P {
      return {
        x:     x  ?? Math.random() * W,
        y:     y  ?? Math.random() * H,
        z:     Math.random() * 0.6 + 0.4,
        vx:    (Math.random() - 0.5) * (burst ? 4.5 : 0.35),
        vy:    (Math.random() - 0.5) * (burst ? 4.5 : 0.35),
        r:     Math.random() * 2.4 + 1.0,
        up:    Math.random() > 0.42,
        age:   0,
        life:  burst ? 130 + Math.random() * 70 : Infinity,
        pulse: Math.random() * Math.PI * 2,
        burst: !!burst,
      };
    }

    /* ── floating signal labels ──────────────────────────────── */
    function spawnLabel(x: number, y: number, label: string, up: boolean | null) {
      const el = document.createElement("div");
      el.textContent = label;
      const bg    = up === true  ? "rgba(61,186,106,0.13)"
                  : up === false ? "rgba(224,85,85,0.13)"
                  :                "rgba(196,148,58,0.13)";
      const color = up === true  ? "#3dba6a"
                  : up === false ? "#e05555"
                  :                "#c4943a";
      el.style.cssText = [
        "position:absolute",
        `left:${x - 20}px`,
        `top:${y - 24}px`,
        "font-size:10px",
        "font-weight:600",
        "padding:3px 9px",
        "border-radius:4px",
        "pointer-events:none",
        "letter-spacing:0.06em",
        "white-space:nowrap",
        "font-family:'DM Sans',sans-serif",
        `background:${bg}`,
        `color:${color}`,
        "transition:opacity .3s",
      ].join(";");
      labels.appendChild(el);
      floaters.push({ el, life: 100 });
    }

    /* ── init ─────────────────────────────────────────────────── */
    particles = Array.from({ length: 90 }, () => mkP());

    /* ── draw loop ───────────────────────────────────────────── */
    function draw() {
      ctx.clearRect(0, 0, W, H);
      frame++;

      /* grid */
      ctx.save();
      ctx.globalAlpha = 0.022;
      ctx.strokeStyle = "#f0f0ee";
      ctx.lineWidth   = 0.5;
      for (let x = 0; x < W; x += 90) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 90) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      /* chart line */
      if (chart.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.beginPath();
        ctx.moveTo(chart[0].x, chart[0].y);
        for (let i = 1; i < chart.length; i++) {
          const p = chart[i - 1], q = chart[i];
          ctx.bezierCurveTo(
            (p.x + q.x) / 2, p.y,
            (p.x + q.x) / 2, q.y,
            q.x, q.y
          );
        }
        ctx.strokeStyle = UP;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle   = UP;
        ctx.globalAlpha = 0.025;
        ctx.fill();
        ctx.restore();
      }

      /* cursor glow */
      if (mouse.x > 0 && mouse.y > 0) {
        const g = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, 110
        );
        g.addColorStop(0, "rgba(61,186,106,0.11)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 110, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        /* centre dot */
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle   = "rgba(61,186,106,0.6)";
        ctx.globalAlpha = 1;
        ctx.fill();
      }

      /* update particles */
      particles = particles.filter(p => {
        p.age++;
        if (p.burst && p.age > p.life) return false;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d  = Math.sqrt(dx * dx + dy * dy);

        /* repel close, attract mid-range */
        if (d < 90 && d > 0) {
          const f = (90 - d) / 90 * 0.10;
          p.vx -= dx / d * f;
          p.vy -= dy / d * f;
        } else if (d < 220 && d > 0) {
          const f = (220 - d) / 220 * 0.024;
          p.vx += dx / d * f;
          p.vy += dy / d * f;
        }

        p.vx += (Math.random() - 0.5) * 0.012;
        p.vy += (Math.random() - 0.5) * 0.012;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x  += p.vx;
        p.y  += p.vy;
        p.pulse += 0.03;

        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        p.x = Math.max(0, Math.min(W, p.x));
        p.y = Math.max(0, Math.min(H, p.y));
        return true;
      });

      /* refill */
      while (particles.filter(p => !p.burst).length < 90) particles.push(mkP());

      /* edges between nearby particles */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a  = particles[i], b = particles[j];
          const dx = a.x - b.x,   dy = a.y - b.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            const al = (1 - d / 130) * 0.20 * Math.min(a.z, b.z);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle =
              a.up === b.up
                ? a.up
                  ? `rgba(61,186,106,${al})`
                  : `rgba(224,85,85,${al})`
                : `rgba(240,240,238,${al * 0.35})`;
            ctx.lineWidth = 0.7 * Math.min(a.z, b.z);
            ctx.stroke();
          }
        }
      }

      /* dots */
      particles.forEach(p => {
        const la = p.burst ? Math.max(0, 1 - p.age / p.life) : 1;
        const r  = p.r * p.z * (1 + Math.sin(p.pulse) * 0.28);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle   = p.up ? UP : DN;
        ctx.globalAlpha = 0.38 * p.z * la;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      /* tick floaters */
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life--;
        f.el.style.top     = (parseFloat(f.el.style.top) - 0.55) + "px";
        f.el.style.opacity = (f.life / 100).toString();
        if (f.life <= 0) {
          try { labels.removeChild(f.el); } catch (_) {}
          floaters.splice(i, 1);
        }
      }

      /* auto-spawn label */
      if (frame % 160 === 0 && particles.length > 0) {
        const p = particles[Math.floor(Math.random() * Math.min(90, particles.length))];
        const opts: [string, boolean | null][] = [
          ["BUY", true], ["BUY", true], ["SELL", false], ["HOLD", null],
        ];
        const [lbl, up] = opts[Math.floor(Math.random() * opts.length)];
        spawnLabel(p.x, p.y, lbl, up);
      }

      raf = requestAnimationFrame(draw);
    }

    /* ── events ──────────────────────────────────────────────── */
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const onClick = (e: MouseEvent) => {
      /* ignore clicks on interactive elements */
      const tag = (e.target as HTMLElement).tagName;
      if (["BUTTON", "INPUT", "A", "LABEL"].includes(tag)) return;

      const x = e.clientX, y = e.clientY;

      /* burst */
      for (let i = 0; i < 22; i++) {
        particles.push(mkP(
          x + (Math.random() - 0.5) * 12,
          y + (Math.random() - 0.5) * 12,
          true
        ));
      }

      /* label */
      const opts: [string, boolean | null][] = [
        ["BUY", true], ["BUY", true], ["SELL", false], ["HOLD", null],
      ];
      const [lbl, up] = opts[Math.floor(Math.random() * opts.length)];
      spawnLabel(x, y, lbl, up);

      /* ripple on canvas */
      let rR = 0, rA = 0.5;
      const rip = () => {
        rR += 5; rA -= 0.025;
        if (rA <= 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, rR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(61,186,106,${rA})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();
        requestAnimationFrame(rip);
      };
      rip();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("click",     onClick);
    window.addEventListener("resize",    resize);

    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click",     onClick);
      window.removeEventListener("resize",    resize);
      floaters.forEach(f => { try { labels.removeChild(f.el); } catch (_) {} });
    };
  }, []);

  return (
    <>
      {/* Canvas — fixed, full viewport, behind everything */}
      <canvas
        ref={canvasRef}
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         "100vw",
          height:        "100vh",
          zIndex:        3,
          pointerEvents: "none",
          display:       "block",
        }}
      />
      {/* Label container — fixed, full viewport, above canvas, below UI */}
      <div
        ref={labelsRef}
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         "100vw",
          height:        "100vh",
          zIndex:        1,
          pointerEvents: "none",
          overflow:      "hidden",
        }}
      />
    </>
  );
}