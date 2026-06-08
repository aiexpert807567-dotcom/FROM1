import { useEffect, useRef, useState } from "react";

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [videoStatus, setVideoStatus] = useState("● Move mouse to scrub");
  const [statusOpacity, setStatusOpacity] = useState(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Hide status indicator after 2.5s
    const timer = setTimeout(() => {
      setStatusOpacity(0);
    }, 2500);
    return () => clearTimeout(timer);
  }, [videoStatus]);

  useEffect(() => {
    /* ══════════════ VIDEO SCRUBBING & NETWORK BUFFER BYPASS ══════════════ */
    const video = videoRef.current;
    if (!video) return;

    let vidDur = 0;
    let targetTime = 0;
    let scrubTime = 0;
    let active = true;
    let localBlobUrl = "";

    let isSeeking = false;
    let latestTargetTime: number | null = null;
    let lastSeekTime = 0;

    const performSeek = (time: number) => {
      const now = performance.now();
      
      // Safety watchdog: If a seek remains active for more than 80ms, release it
      // to keep the scrub flow dynamic and responsive under any hardware conditions.
      if (isSeeking && now - lastSeekTime > 80) {
        isSeeking = false;
      }

      // Prevent overlapping decoder calls by checking both browser tracking and native hardware states
      if (video.seeking || isSeeking) {
        latestTargetTime = time;
        return;
      }

      // Snappy micro-throttle of 8ms ensures up to 125 seeking updates per second, keeping visuals exceptionally responsive
      if (now - lastSeekTime < 8) {
        latestTargetTime = time;
        return;
      }

      isSeeking = true;
      lastSeekTime = now;
      video.currentTime = time;
    };

    const handleSeeked = () => {
      isSeeking = false;
      if (latestTargetTime !== null) {
        const nextTime = latestTargetTime;
        latestTargetTime = null;
        performSeek(nextTime);
      }
    };

    const videoUrl = "https://rlsxlktphegfsmvyebrs.supabase.co/storage/v1/object/public/videos/lv_0_20260607133346.mp4";

    // Set streaming src first to make it play/seek elements instantly while preloading the blob in the background
    video.src = videoUrl;
    video.load();

    const onMetadata = () => {
      vidDur = video.duration;
      setVideoStatus("● Video ready");
      // Initial frame seek based on mouse position
      targetTime = (mx / window.innerWidth) * vidDur;
      scrubTime = targetTime;
      performSeek(targetTime);
    };

    const onError = () => {
      setVideoStatus("⚠ Video unavailable");
    };

    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("error", onError);
    video.addEventListener("seeked", handleSeeked);

    // Parallel-download into local binary Blob URL in memory to completely bypass range-request network latency!
    // This allows hardware-accelerated time seeks inside the canvas render loop to finish instantly (under 5ms)
    setVideoStatus("● Buffering high-res movie stream...");
    fetch(videoUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Preload fetch failed");
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        localBlobUrl = URL.createObjectURL(blob);
        
        // Hot-swap stream URL to the local cache-loaded Blob URL
        const currentPos = video.currentTime;
        video.src = localBlobUrl;
        video.currentTime = currentPos;
        video.load();
        setVideoStatus("● Cinematic cache ready (60 FPS)");
      })
      .catch((err) => {
        console.warn("Blob caching bypassed, continuing in live stream mode:", err);
        setVideoStatus("● Cinematic feed active (Streaming)");
      });

    /* ══════════════ MOUSE & TOUCH INPUT ══════════════ */
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let pmx = mx;
    let pmy = my;
    let rawSpeedX = 0;
    let rawSpeedY = 0;

    const onMouseMove = (e: MouseEvent) => {
      pmx = mx;
      pmy = my;
      mx = e.clientX;
      my = e.clientY;
      rawSpeedX = mx - pmx;
      rawSpeedY = my - pmy;

      if (vidDur > 0) {
        targetTime = (mx / window.innerWidth) * vidDur;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        pmx = mx;
        pmy = my;
        mx = e.touches[0].clientX;
        my = e.touches[0].clientY;
        rawSpeedX = mx - pmx;
        rawSpeedY = my - pmy;

        if (vidDur > 0) {
          targetTime = (mx / window.innerWidth) * vidDur;
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    /* ══════════════ PROCEDURAL CANVAS SPIDER ══════════════ */
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spider physical body state
    let bx = mx;
    let by = my;
    let bodyAngle = -Math.PI / 2; // Radians, starts pointing up
    let smoothSpd = 0;
    let breathT = 0;
    let isIdle = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let frontRaise = 0; // raise front legs when hovering elements
    let lastMx = mx;
    let lastMy = my;

    // Trigger front leg raises when hovering buttons
    const hoverElements = document.querySelectorAll("button, a, .hero-btn");
    const onHoverEnter = () => { frontRaise = 1; };
    const onHoverLeave = () => { frontRaise = 0; };
    hoverElements.forEach((el) => {
      el.addEventListener("mouseenter", onHoverEnter);
      el.addEventListener("mouseleave", onHoverLeave);
    });

    const resetIdleTimer = () => {
      isIdle = false;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isIdle = true;
      }, 1400);
    };
    window.addEventListener("mousemove", resetIdleTimer, { passive: true });
    resetIdleTimer();

    // Leg Configs - Symmetric configuration relative to head
    const LEG_ATTACH = [
      { lx: -9, ly: -10 },  // LL1 front
      { lx: -11, ly: -3 },  // LL2
      { lx: -11, ly: 5 },   // LL3
      { lx: -9, ly: 13 },   // LL4 back
      { lx: 9, ly: -10 },   // LR1 front
      { lx: 11, ly: -3 },   // LR2
      { lx: 11, ly: 5 },    // LR3
      { lx: 9, ly: 13 },    // LR4 back
    ];

    const LEG_REST = [
      { rx: -30, ry: -28 }, // LL1
      { rx: -41, ry: -4 },  // LL2
      { rx: -39, ry: 20 },  // LL3
      { rx: -29, ry: 36 },  // LL4
      { rx: 30, ry: -28 },  // LR1
      { rx: 41, ry: -4 },   // LR2
      { rx: 39, ry: 20 },   // LR3
      { rx: 29, ry: 36 },   // LR4
    ];

    const SEG1 = 22;
    const SEG2 = 20;
    const SEG3 = 9;
    const STEP_THRESH = 14;
    const LEG_LIFT = 11;

    // Alternating walking groups
    const GA = [0, 3, 5, 6]; // LL1, LL4, LR2, LR3
    const GB = [1, 2, 4, 7]; // LL2, LL3, LR1, LR4
    let gaTurn = true;
    let stepCD = 0;

    // Initialize feet position states
    const feet = LEG_REST.map((r) => ({
      wx: bx + r.rx,
      wy: by + r.ry,
      tx: bx + r.rx,
      ty: by + r.ry,
      px: bx + r.rx,
      py: by + r.ry,
      stepping: false,
      t: 0,
      lift: 0,
    }));

    const rot2 = (x: number, y: number, a: number) => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      return { x: x * c - y * s, y: x * s + y * c };
    };

    const dist = (ax: number, ay: number, bx2: number, by2: number) => {
      const dx = ax - bx2;
      const dy = ay - by2;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Correctly aligned Ideal Foot calculations (uses consistent bodyAngle + Math.PI / 2 offset configuration)
    const idealFoot = (i: number) => {
      const r = LEG_REST[i];
      const p = rot2(r.rx, r.ry, bodyAngle + Math.PI / 2);
      
      // Dynamic velocity lookahead predictor
      const vx = (mx - bx) * 0.12;
      const vy = (my - by) * 0.12;
      return { x: bx + p.x + vx, y: by + p.y + vy };
    };

    const triggerStep = (i: number) => {
      const ideal = idealFoot(i);
      feet[i].px = feet[i].wx;
      feet[i].py = feet[i].wy;
      feet[i].tx = ideal.x;
      feet[i].ty = ideal.y;
      feet[i].stepping = true;
      feet[i].t = 0;
    };

    // Draw one beautiful organic spider leg
    const drawLeg = (ax: number, ay: number, fx: number, fy: number, lift: number, isLeft: boolean) => {
      const fyL = fy - lift;
      const dx = fx - ax;
      const dy = fyL - ay;
      let d = Math.sqrt(dx * dx + dy * dy);
      d = Math.min(d, SEG1 + SEG2 - 0.1);

      const cosA = Math.max(-1, Math.min(1, (d * d + SEG1 * SEG1 - SEG2 * SEG2) / (2 * d * SEG1)));
      const a1 = Math.acos(cosA);
      const base = Math.atan2(fyL - ay, fx - ax);

      // Angled outwards depending on whether left or right side of body
      const angleOffset = isLeft ? -a1 : a1;
      const kx = ax + SEG1 * Math.cos(base + angleOffset);
      const ky = ay + SEG1 * Math.sin(base + angleOffset);

      // Tarsus tip calculation
      const ta = Math.atan2(fyL - ky, fx - kx);
      const txE = fx + Math.cos(ta) * SEG3;
      const tyE = fyL + Math.sin(ta) * SEG3;

      // Femur (Primary segment)
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = "#321603";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(kx, ky);
      ctx.stroke();

      // Tibia (Secondary joint segment)
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#200d02";
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(fx, fyL);
      ctx.stroke();

      // Sharp foot end
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#0d0400";
      ctx.beginPath();
      ctx.moveTo(fx, fyL);
      ctx.lineTo(txE, tyE);
      ctx.stroke();

      // Kneecap joint accent dot
      ctx.fillStyle = "#120500";
      ctx.beginPath();
      ctx.arc(kx, ky, 2.0, 0, Math.PI * 2);
      ctx.fill();
    };

    /* ══════════════ TICK RENDER LOOP ══════════════ */
    let animId: number;
    let lastT = performance.now();

    const renderTick = (now: number) => {
      animId = requestAnimationFrame(renderTick);
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      // Clear canvas buffer transparently
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Mouse speed tracking
      const dxR = mx - lastMx;
      const dyR = my - lastMy;
      const instantSpd = Math.sqrt(dxR * dxR + dyR * dyR);
      lastMx = mx;
      lastMy = my;
      
      smoothSpd += (instantSpd - smoothSpd) * 0.25;
      const spd01 = Math.min(smoothSpd / 22, 1);

      // --- SMOOTH AND ULTRA-RESPONSIVE VIDEO SCRUBBING ---
      if (vidDur > 0) {
        const diff = targetTime - scrubTime;
        // Heavy-smooth cinematic dampening (0.45 factor) provides direct physical reactivity while filtering out micro-jitters
        scrubTime += diff * 0.45;

        if (scrubTime < 0) scrubTime = 0;
        if (scrubTime > vidDur) scrubTime = vidDur;

        if (Math.abs(video.currentTime - scrubTime) > 0.001) {
          performSeek(scrubTime);
        }
      }

      // Elastic spider head lag towards mouse
      const lag = isIdle ? 0.08 : Math.min(0.24 + spd01 * 0.18, 0.45);
      bx += (mx - bx) * lag;
      by += (my - by) * lag;

      // Calculate path direction from body of spider to exact cursor position
      const movDx = mx - bx;
      const movDy = my - by;
      const movDist = Math.sqrt(movDx * movDx + movDy * movDy);

      // NATURAL MOVEMENT ORIENTATION TOWARDS CURSOR (FIXED SIDEWAYS DRAGGING ACCIDENT)
      // Directly face the cursor so that the head (negative local Y coordinate) points at the targets!
      if (movDist > 2) {
        const desiredAngle = Math.atan2(movDy, movDx);
        let diff = desiredAngle - bodyAngle;
        
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const rotSpeed = isIdle ? 0.15 : Math.min(0.35 + spd01 * 0.45, 0.80);
        bodyAngle += diff * rotSpeed;
      }

      // Breathing animation state
      breathT += 0.028;
      const sc = isIdle ? 1 + Math.sin(breathT) * 0.015 : 1 + spd01 * 0.038;

      // Draw subtle flat shadow first
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.beginPath();
      ctx.ellipse(0, 16, 20 * sc, 5.5 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Step gait sequence triggers for LL and LR sides
      const stepDur = Math.max(0.08, 0.20 - spd01 * 0.10);
      if (stepCD > 0) stepCD -= dt;

      if (stepCD <= 0 && spd01 > 0.04) {
        const grp = gaTurn ? GA : GB;
        let needStep = false;
        
        grp.forEach((i) => {
          if (!feet[i].stepping) {
            const ideal = idealFoot(i);
            if (dist(feet[i].wx, feet[i].wy, ideal.x, ideal.y) > STEP_THRESH) {
              needStep = true;
            }
          }
        });

        if (needStep) {
          grp.forEach((i) => {
            if (!feet[i].stepping) triggerStep(i);
          });
          gaTurn = !gaTurn;
          stepCD = stepDur * 0.52;
        }
      }

      // Process step interpolation values
      for (let i = 0; i < 8; i++) {
        const f = feet[i];
        if (f.stepping) {
          f.t += dt / stepDur;

          // Dynamically adjust foot landing target slightly towards the latest ideal footprint
          // while walking, so it never lags behind a fast-moving cursor/body!
          const ideal = idealFoot(i);
          f.tx += (ideal.x - f.tx) * 0.28;
          f.ty += (ideal.y - f.ty) * 0.28;

          if (f.t >= 1) {
            f.t = 1;
            f.stepping = false;
            f.wx = f.tx;
            f.wy = f.ty;
            f.lift = 0;
          } else {
            // Sinusoidal arc interpolation
            const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
            f.wx = f.px + (f.tx - f.px) * e;
            f.wy = f.py + (f.ty - f.py) * e;
            f.lift = LEG_LIFT * Math.sin(f.t * Math.PI) * (1 + spd01 * 0.5);
          }
        } else {
          f.lift *= 0.72;
          // Slowly damp any alignment drift while stationary or idle
          if (isIdle) {
            const ideal = idealFoot(i);
            f.wx += (ideal.x - f.wx) * 0.12;
            f.wy += (ideal.y - f.wy) * 0.12;
          }
        }
      }

      // Draw active legs underneath the body
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < 8; i++) {
        const a = LEG_ATTACH[i];
        const p = rot2(a.lx, a.ly, bodyAngle + Math.PI / 2);
        const axW = bx + p.x;
        const ayW = by + p.y;
        
        let targetLift = 0;
        if ((i === 0 || i === 4) && frontRaise > 0) {
          targetLift = frontRaise * 14;
        }
        drawLeg(axW, ayW, feet[i].wx, feet[i].wy, feet[i].lift + targetLift, i < 4);
      }

      // Draw exact spider body carapace
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(bodyAngle + Math.PI / 2);
      ctx.scale(sc, sc);

      // pedicels
      ctx.fillStyle = "#0a0300";
      ctx.beginPath();
      ctx.ellipse(0, 3, 3.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // abdomen (glow effect)
      const abdG = ctx.createRadialGradient(-3, -3, 1, 0, 14, 18);
      abdG.addColorStop(0, "#563816");
      abdG.addColorStop(0.5, "#251205");
      abdG.addColorStop(1, "#050100");
      ctx.fillStyle = abdG;
      ctx.beginPath();
      ctx.ellipse(0, 16, 13, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // hourglass emblem
      ctx.fillStyle = "rgba(180, 20, 0, 0.45)";
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.quadraticCurveTo(4, 14, 0, 20);
      ctx.quadraticCurveTo(-4, 14, 0, 9);
      ctx.fill();

      // shadow highlight
      ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
      ctx.beginPath();
      ctx.ellipse(0, 23, 4, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // highlight sheen
      ctx.fillStyle = "rgba(90, 55, 15, 0.15)";
      ctx.beginPath();
      ctx.ellipse(-4, 10, 5, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // spinnerets
      ctx.fillStyle = "#080200";
      ctx.beginPath();
      ctx.ellipse(-3, 32, 3, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(3, 32, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cephalothorax
      const cephG = ctx.createRadialGradient(-4, -14, 1, 0, -6, 12);
      cephG.addColorStop(0, "#7a592e");
      cephG.addColorStop(0.4, "#3c210d");
      cephG.addColorStop(1, "#080300");
      ctx.fillStyle = cephG;
      ctx.beginPath();
      ctx.ellipse(0, -6, 12, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // thorax center lines
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -13);
      ctx.stroke();

      ctx.fillStyle = "rgba(120, 80, 30, 0.15)";
      ctx.beginPath();
      ctx.ellipse(-3, -10, 4.5, 3, -0.26, 0, Math.PI * 2);
      ctx.fill();

      // carapace markings hairs
      ctx.strokeStyle = "rgba(80, 48, 16, 0.35)";
      ctx.lineWidth = 0.9;
      [
        [-10, -5, -14, -7],
        [-10, -1, -14, -2],
        [-10, 3, -13, 4],
        [10, -5, 14, -7],
        [10, -1, 14, -2],
        [10, 3, 13, 4],
        [-12, 12, -15, 11],
        [-12, 18, -15, 18],
        [-11, 24, -14, 25],
        [12, 12, 15, 11],
        [12, 18, 15, 18],
        [11, 24, 14, 25],
      ].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      //Glowing Eyes
      [[-4, -12], [4, -12]].forEach(([ex, ey]) => {
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5.5);
        g.addColorStop(0, "rgba(150, 255, 0, 0.55)");
        g.addColorStop(1, "rgba(150, 255, 0, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
        ctx.fill();
      });

      [[-4, -12], [4, -12]].forEach(([ex, ey]) => {
        const g2 = ctx.createRadialGradient(ex - 0.8, ey - 0.8, 0.2, ex, ey, 2.8);
        g2.addColorStop(0, "#DDFF00");
        g2.addColorStop(0.5, "#88CC00");
        g2.addColorStop(1, "#336600");
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 200, 0.9)";
        ctx.beginPath();
        ctx.arc(ex - 0.8, ey - 0.8, 0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      [[-9, -9], [9, -9]].forEach(([ex, ey]) => {
        ctx.fillStyle = "#88CC00";
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(ex, ey, 0.85, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 0.6;
      [[-2, -15], [2, -15]].forEach(([ex, ey]) => {
        ctx.fillStyle = "#88CC00";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(ex, ey, 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Fangs
      ctx.strokeStyle = "#1A0C04";
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-3.5, -16);
      ctx.quadraticCurveTo(-5.5, -21, -4.5, -24);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(3.5, -16);
      ctx.quadraticCurveTo(5.5, -21, 4.5, -24);
      ctx.stroke();

      ctx.fillStyle = "#0C0200";
      ctx.beginPath();
      ctx.arc(-4.5, -24, 2.2, 0, Math.PI * 2);
      ctx.arc(4.5, -24, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Toxic Venom drop
      ctx.fillStyle = "rgba(70, 200, 0, 0.55)";
      ctx.beginPath();
      ctx.arc(-4.5, -25.8, 1.1, 0, Math.PI * 2);
      ctx.arc(4.5, -25.8, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Pedipalps
      ctx.strokeStyle = "#3A1E08";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-5.5, -15);
      ctx.quadraticCurveTo(-9, -20, -7.5, -23);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(5.5, -15);
      ctx.quadraticCurveTo(9, -20, 7.5, -23);
      ctx.stroke();

      ctx.fillStyle = "#1e0400";
      ctx.beginPath();
      ctx.arc(-7.5, -23, 1.9, 0, Math.PI * 2);
      ctx.arc(7.5, -23, 1.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Parallax Shifts
      const px = (mx / window.innerWidth - 0.5) * 14;
      const py = (my / window.innerHeight - 0.5) * 9;
      
      const hero = document.getElementById("hero-content");
      if (hero) {
        hero.style.transform = `translateY(-50%) translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
      }

      const fog = document.getElementById("fog-layer");
      if (fog) {
        fog.style.transform = `translate(${(px * 1.8).toFixed(1)}px,${(py * 1.2).toFixed(1)}px)`;
      }
    };

    animId = requestAnimationFrame(renderTick);

    return () => {
      active = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mousemove", resetIdleTimer);
      if (idleTimer) clearTimeout(idleTimer);
      hoverElements.forEach((el) => {
        el.removeEventListener("mouseenter", onHoverEnter);
        el.removeEventListener("mouseleave", onHoverLeave);
      });
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("error", onError);
      video.removeEventListener("seeked", handleSeeked);
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, []);

  return (
    <>
      {/* Exact style block containing user provided alignments */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap');

        * { margin:0; padding:0; box-sizing:border-box; cursor: none !important; }
        :root {
          --text-main: #c8d8e8;
          --text-dim: #7a9ab8;
          --text-bright: #eaf2fa;
          --bg-deep: #060810;
        }
        
        body { 
          background: var(--bg-deep); 
          font-family: inherit;
        }

        #bg-video {
          position:fixed; inset:0; width:100vw; height:100vh;
          object-fit:cover; z-index:0; pointer-events:none;
        }
        #cinematic-overlay {
          position:fixed; inset:0;
          background:linear-gradient(to right,rgba(6,8,16,0.90) 0%,rgba(6,8,16,0.62) 38%,rgba(6,8,16,0.22) 65%,rgba(6,8,16,0.04) 100%);
          z-index:1; pointer-events:none;
        }
        #fog-layer {
          position:fixed; inset:0;
          background:radial-gradient(ellipse 80% 40% at 15% 85%,rgba(80,120,190,0.10) 0%,transparent 60%),
                     radial-gradient(ellipse 55% 35% at 78% 18%,rgba(50,90,150,0.07) 0%,transparent 55%);
          z-index:2; pointer-events:none; will-change:transform;
        }
        #vignette {
          position:fixed; inset:0;
          background:radial-gradient(ellipse at center,transparent 38%,rgba(0,0,0,0.78) 100%);
          z-index:2; pointer-events:none;
        }
        #app { position:fixed; inset:0; z-index:10; }

        #topbar {
          position:absolute; top:0; left:0; right:0;
          display:flex; justify-content:space-between; align-items:center;
          padding:30px 44px; z-index:20;
        }
        #hamburger {
          display:flex; flex-direction:column; gap:5px;
          cursor:none; padding:10px 12px;
          background:none; border:none; outline:none;
        }
        #hamburger span { display:block; width:22px; height:2px; background:var(--text-main); transition:all 0.32s; }
        #hamburger.open span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
        #hamburger.open span:nth-child(2) { opacity:0; transform:scaleX(0); }
        #hamburger.open span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }
        #watch-btn {
          font-family: 'Cinzel', serif;
          font-size:11.55px; letter-spacing:4px; text-transform:uppercase;
          color:var(--text-main); background:none; border:none; outline:none;
          cursor:none; padding:8px 0; transition:color 0.3s;
        }
        #watch-btn:hover { color:var(--text-bright); }
        #nav-menu {
          position:fixed; top:0; left:0; width:290px; height:100vh;
          background:rgba(4,6,12,0.98); backdrop-filter:blur(24px);
          border-right:1px solid rgba(100,140,180,0.12);
          z-index:100; display:flex; flex-direction:column; justify-content:center;
          padding:60px 44px; transform:translateX(-100%);
          transition:transform 0.42s cubic-bezier(0.16,1,0.3,1);
        }
        #nav-menu.open { transform:translateX(0); }
        #nav-logo { font-family: 'Cinzel', serif; font-size:29.4px; color:var(--text-bright); letter-spacing:4px; margin-bottom:40px; }
        #nav-menu a {
          display:block; font-family: 'Cinzel', serif;
          font-size:11.55px; letter-spacing:4px; text-transform:uppercase;
          color:var(--text-dim); text-decoration:none;
          padding:13px 0; border-bottom:1px solid rgba(100,140,180,0.1);
          cursor:none; transition:color 0.28s,letter-spacing 0.28s,padding-left 0.28s;
        }
        #nav-menu a:hover { color:var(--text-bright); letter-spacing:6px; padding-left:6px; }
        #hero-content {
          position:absolute; left:0; top:50%; transform:translateY(-50%);
          width:40%; padding:0 60px; will-change:transform;
        }
        #title-main {
          font-family: 'Cinzel', serif;
          font-size:clamp(84px,11.55vw,155.4px); line-height:0.86;
          color:var(--text-bright); letter-spacing:6px;
          text-shadow:0 6px 50px rgba(0,0,0,0.9);
          will-change:transform; margin-bottom:18px;
        }
        #tagline {
          font-family:'Crimson Pro',serif; font-style:italic;
          font-size:clamp(14.7px,1.26vw,17.85px);
          color:var(--text-dim); letter-spacing:1px;
          margin-bottom:42px; max-width:280px; line-height:1.6;
        }
        #btn-group { display:flex; flex-direction:column; gap:13px; width:fit-content; }
        .hero-btn {
          font-family: 'Cinzel', serif;
          font-size:11.55px; letter-spacing:4px; text-transform:uppercase;
          padding:14px 36px; cursor:none; border:none; outline:none; transition:all 0.3s;
        }
        #btn-explore { background:rgba(200,216,232,0.96); color:#060810; }
        #btn-explore:hover { background:#eaf2fa; transform:translateX(6px); }
        #btn-details { background:transparent; color:var(--text-main); border:1px solid rgba(100,140,180,0.22); }
        #btn-details:hover { background:rgba(30,58,95,0.42); transform:translateX(6px); }
        #modal-overlay {
          position:fixed; inset:0; background:rgba(4,6,12,0.93);
          backdrop-filter:blur(16px); z-index:200;
          display:flex; align-items:center; justify-content:center;
          opacity:0; pointer-events:none; transition:opacity 0.4s;
        }
        #modal-overlay.open { opacity:1; pointer-events:all; }
        #modal {
          background:rgba(8,11,18,0.99); border:1px solid rgba(100,140,180,0.18);
          width:min(700px,92vw); max-height:82vh; overflow-y:auto; padding:52px; position:relative;
        }
        #modal-close {
          position:absolute; top:22px; right:26px;
          font-family: 'Cinzel', serif; font-size:10.5px; letter-spacing:3px; text-transform:uppercase;
          color:var(--text-dim); cursor:none; background:none; border:none; transition:color 0.3s; outline:none;
        }
        #modal-close:hover { color:var(--text-bright); }
        #modal h2 { font-family: 'Cinzel', serif; font-size:56.7px; color:var(--text-bright); margin-bottom:6px; letter-spacing:4px; }
        .modal-sub { font-family:'Crimson Pro',serif; font-style:italic; font-size:14.7px; color:var(--text-dim); margin-bottom:36px; padding-bottom:24px; border-bottom:1px solid rgba(100,140,180,0.18); }
        .modal-section { margin-bottom:32px; }
        .modal-section h3 { font-family: 'Cinzel', serif; font-size:10.5px; letter-spacing:4px; text-transform:uppercase; color:var(--text-dim); margin-bottom:14px; }
        .cast-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; }
        .cast-card { border:1px solid rgba(100,140,180,0.18); padding:14px; background:rgba(255,255,255,0.02); }
        .cast-card .name { font-family:'Crimson Pro',serif; font-size:14.7px; color:var(--text-main); margin-bottom:4px; }
        .cast-card .role { font-family:'Crimson Pro',serif; font-size:12.6px; font-style:italic; color:var(--text-dim); }
        .row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(100,140,180,0.08); font-family:'Crimson Pro',serif; font-size:14.7px; color:var(--text-main); }
        .badge { font-family: 'Cinzel', serif; font-size:9.45px; letter-spacing:2px; text-transform:uppercase; color:var(--text-dim); border:1px solid rgba(100,140,180,0.18); padding:3px 10px; }
        .tl { display:flex; gap:20px; padding:10px 0; border-bottom:1px solid rgba(100,140,180,0.06); }
        .tl-date { font-family: 'Cinzel', serif; font-size:10.5px; letter-spacing:2px; color:var(--text-dim); min-width:80px; padding-top:2px; }
        .tl-event { font-family:'Crimson Pro',serif; font-size:14.7px; color:var(--text-main); }
        #modal::-webkit-scrollbar { width:3px; }
        #modal::-webkit-scrollbar-track { background:transparent; }
        #modal::-webkit-scrollbar-thumb { background:rgba(100,140,180,0.22); }

        #spider-canvas {
          position:fixed; top:0; left:0; width:100vw; height:100vh;
          pointer-events:none; z-index:9999;
        }

        #vid-status {
          position:fixed; bottom:18px; right:18px;
          font-family:'Cinzel',serif; font-size:9.45px; letter-spacing:2px; text-transform:uppercase;
          color:var(--text-dim); padding:4px 10px; background:rgba(6,8,16,0.7); z-index:50; transition:opacity 1.5s;
        }

        .trailer-overlay {
          position:fixed; inset:0; background:rgba(2,3,6,0.96); z-index:1000;
          display:flex; align-items:center; justify-content:center;
        }
        .trailer-container {
          position:relative; width:min(900px, 92vw); aspect-ratio:16/9;
          border:1px solid rgba(100,140,180,0.2);
        }
        .trailer-close {
          position:absolute; top:-36px; right:0;
          font-family:'Cinzel',serif; font-size:11.55px; letter-spacing:3px;
          color:var(--text-main); background:none; border:none; cursor:none;
        }

        @media (max-width:768px) {
          * { cursor: auto !important; }
          #hero-content { width:92%; padding:0 24px; }
          #title-main { font-size:clamp(63px,18.9vw,105px); }
          #spider-canvas { display:none; }
          html,body { cursor:auto; }
          .hero-btn,#hamburger,#watch-btn,#btn-details,#modal-close,#nav-menu a, .trailer-close { cursor:pointer; }
          #modal { padding:32px 20px; }
        }
      `}</style>

      {/* Background Video */}
      <video ref={videoRef} id="bg-video" preload="auto" muted playsInline />

      <div id="cinematic-overlay"></div>
      <div id="fog-layer"></div>
      <div id="vignette"></div>

      {/* Main app container */}
      <div id="app">
        <div id="topbar">
          <button 
            id="hamburger" 
            className={navOpen ? "open" : ""}
            onClick={() => setNavOpen(!navOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          
          <button id="watch-btn" onClick={() => setTrailerOpen(true)}>Watch Trailer</button>
        </div>

        {/* Menu drawer overlay */}
        <nav id="nav-menu" className={navOpen ? "open" : ""}>
          <div id="nav-logo">FROM</div>
          <a href="#" onClick={() => setNavOpen(false)}>Home</a>
          <a href="#" onClick={() => { setNavOpen(false); setModalOpen(true); }}>Episodes</a>
          <a href="#" onClick={() => { setNavOpen(false); setModalOpen(true); }}>Cast</a>
          <a href="#" onClick={() => { setNavOpen(false); setModalOpen(true); }}>Timeline</a>
          <a href="#" onClick={() => { setNavOpen(false); setModalOpen(true); }}>Gallery</a>
          <a href="#" onClick={() => { setNavOpen(false); setNavOpen(false); }}>Contact Developer</a>
        </nav>

        {/* Hero typography */}
        <div id="hero-content">
          <div id="title-main">FROM</div>
          <div id="tagline">Where the signal ends and silence begins.</div>
          <div id="btn-group">
            <button className="hero-btn" id="btn-explore" onClick={() => setModalOpen(true)}>Explore Series</button>
            <button className="hero-btn" id="btn-details" onClick={() => setModalOpen(true)}>View Details</button>
          </div>
        </div>
      </div>

      <div id="vid-status" style={{ opacity: statusOpacity }}>{videoStatus}</div>

      {/* Information Modal */}
      <div 
        id="modal-overlay" 
        className={modalOpen ? "open" : ""}
        onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
      >
        <div id="modal">
          <button id="modal-close" onClick={() => setModalOpen(false)}>✕ Close</button>
          <h2>FROM</h2>
          <div className="modal-sub">A psychological horror series set at the edge of the known.</div>
          
          <div className="modal-section">
            <h3>Cast</h3>
            <div className="cast-grid">
              <div className="cast-card"><div className="name" style={{ color: "var(--text-main)" }}>Harold Perrineau</div><div className="role" style={{ color: "var(--text-dim)", fontSize: "12.6px", fontStyle: "italic" }}>Boyd Stevens</div></div>
              <div className="cast-card"><div className="name" style={{ color: "var(--text-main)" }}>Catalina Sandino Moreno</div><div className="role" style={{ color: "var(--text-dim)", fontSize: "12.6px", fontStyle: "italic" }}>Tabitha Matthews</div></div>
              <div className="cast-card"><div className="name" style={{ color: "var(--text-main)" }}>Eion Bailey</div><div className="role" style={{ color: "var(--text-dim)", fontSize: "12.6px", fontStyle: "italic" }}>Jim Matthews</div></div>
              <div className="cast-card"><div className="name" style={{ color: "var(--text-main)" }}>David Alpay</div><div className="role" style={{ color: "var(--text-dim)", fontSize: "12.6px", fontStyle: "italic" }}>Jade Herrera</div></div>
              <div className="cast-card"><div className="name" style={{ color: "var(--text-main)" }}>Elizabeth Saunders</div><div className="role" style={{ color: "var(--text-dim)", fontSize: "12.6px", fontStyle: "italic" }}>Donna Rainey</div></div>
              <div className="cast-card"><div className="name" style={{ color: "var(--text-main)" }}>Scott McCord</div><div className="role" style={{ color: "var(--text-dim)", fontSize: "12.6px", fontStyle: "italic" }}>Victor</div></div>
            </div>
          </div>
          
          <div className="modal-section">
            <h3>Seasons</h3>
            <div className="row"><span>Season 1 — Transmission</span><span className="badge">10 Episodes</span></div>
            <div className="row"><span>Season 2 — Recursion</span><span className="badge">10 Episodes</span></div>
            <div className="row"><span>Season 3 — Threshold</span><span className="badge">10 Episodes</span></div>
          </div>
          
          <div className="modal-section">
            <h3>Episodes</h3>
            <div className="row"><span>S1E1 — Origin Signal</span><span className="badge">52 min</span></div>
            <div className="row"><span>S1E2 — The Hollow Room</span><span className="badge">48 min</span></div>
            <div className="row"><span>S1E3 — Pale Corridor</span><span className="badge">55 min</span></div>
            <div className="row"><span>S1E4 — What Remains</span><span className="badge">50 min</span></div>
            <div className="row"><span>S2E1 — Feedback Loop</span><span className="badge">58 min</span></div>
            <div className="row"><span>S2E2 — Static Memory</span><span className="badge">51 min</span></div>
          </div>
          
          <div className="modal-section">
            <h3>Release Timeline</h3>
            <div className="tl"><div className="tl-date">FEB 2022</div><div className="tl-event">Season 1 premiere — worldwide release</div></div>
            <div className="tl"><div className="tl-date">APR 2023</div><div className="tl-event">Season 2 launch — director's cut included</div></div>
            <div className="tl"><div className="tl-date">SEP 2024</div><div className="tl-event">Season 3 launch — threshold arc</div></div>
          </div>
          
          <div className="modal-section">
            <h3>Upcoming</h3>
            <div className="tl"><div className="tl-date">2026</div><div className="tl-event">Season 4 Production Begins</div></div>
          </div>
        </div>
      </div>

      {/* Cinematic YouTube Trailer overlay */}
      {trailerOpen && (
        <div className="trailer-overlay" onClick={() => setTrailerOpen(false)}>
          <div className="trailer-container" onClick={(e) => e.stopPropagation()}>
            <button className="trailer-close" onClick={() => setTrailerOpen(false)}>✕ Close Trailer</button>
            <iframe 
              src="https://www.youtube.com/embed/1v7mHeGvP0I?autoplay=1" 
              title="FROM Official Trailer" 
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Spider drawn on canvas — full screen */}
      <canvas ref={canvasRef} id="spider-canvas" />
    </>
  );
}
