import { useEffect, useRef, useState } from "react";

export type GameState = "ready" | "playing" | "over";

type Bamboo = {
  id: number;
  x: number;
  gapY: number;
  passed: boolean;
};

const WIDTH = 420;
const HEIGHT = 640;
const PANDA_X = 96;
const PANDA_SIZE = 38;
const GRAVITY = 0.42;
const JUMP = -7.6;
const BAMBOO_WIDTH = 62;
const GAP_HEIGHT = 168;
const BAMBOO_SPACING = 230;
const GROUND_HEIGHT = 74;
const GAME_SPEED = 2.45;
const BEST_SCORE_STORAGE_KEY = "sao-fu-rui-best";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function randomGapY() {
  return 150 + Math.random() * 260;
}

function makeInitialBamboo(): Bamboo[] {
  return Array.from({ length: 4 }, (_, index) => ({
    id: index,
    x: WIDTH + 90 + index * BAMBOO_SPACING,
    gapY: randomGapY(),
    passed: false,
  }));
}

function drawPixelPanda(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, vy: number) {
  const tilt = clamp(vy / 18, -0.42, 0.62);
  const px = size / 16;

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(tilt);
  ctx.translate(-size / 2, -size / 2);
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#17251c";
  ctx.fillRect(2 * px, 3 * px, 12 * px, 11 * px);
  ctx.fillRect(1 * px, 4 * px, 3 * px, 3 * px);
  ctx.fillRect(12 * px, 4 * px, 3 * px, 3 * px);

  ctx.fillStyle = "#101814";
  ctx.fillRect(1 * px, 3 * px, 4 * px, 4 * px);
  ctx.fillRect(11 * px, 3 * px, 4 * px, 4 * px);

  ctx.fillStyle = "#f5f1dc";
  ctx.fillRect(3 * px, 4 * px, 10 * px, 9 * px);
  ctx.fillRect(4 * px, 3 * px, 8 * px, 1 * px);
  ctx.fillRect(4 * px, 13 * px, 8 * px, 1 * px);

  ctx.fillStyle = "#1a221d";
  ctx.fillRect(4 * px, 6 * px, 3 * px, 3 * px);
  ctx.fillRect(9 * px, 6 * px, 3 * px, 3 * px);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(5 * px, 6 * px, px, px);
  ctx.fillRect(10 * px, 6 * px, px, px);

  ctx.fillStyle = "#111815";
  ctx.fillRect(7 * px, 9 * px, 2 * px, px);
  ctx.fillRect(8 * px, 10 * px, px, px);
  ctx.fillRect(6 * px, 11 * px, px, px);
  ctx.fillRect(9 * px, 11 * px, px, px);

  ctx.fillStyle = "#e7a69a";
  ctx.fillRect(3 * px, 10 * px, 2 * px, px);
  ctx.fillRect(11 * px, 10 * px, 2 * px, px);

  ctx.fillStyle = "#d9352a";
  ctx.fillRect(5 * px, 13 * px, 7 * px, px);
  ctx.fillRect(10 * px, 14 * px, 2 * px, px);
  ctx.fillStyle = "#ffd16a";
  ctx.fillRect(7 * px, 13 * px, px, px);

  ctx.restore();
}

function drawBambooTrunk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inverted = false) {
  const segment = 34;
  const top = y;
  const bottom = y + h;

  ctx.fillStyle = "#1d7f4a";
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#30a864";
  ctx.fillRect(x + 7, y, 13, h);
  ctx.fillRect(x + w - 18, y, 8, h);

  ctx.fillStyle = "#0f6339";
  ctx.fillRect(x + w - 8, y, 8, h);
  ctx.fillRect(x, y, 5, h);

  ctx.fillStyle = "#0b4d2e";
  for (let lineY = top + 18; lineY < bottom; lineY += segment) {
    ctx.fillRect(x - 3, lineY, w + 6, 5);
    ctx.fillStyle = "#59c378";
    ctx.fillRect(x + 6, lineY + 1, w - 18, 2);
    ctx.fillStyle = "#0b4d2e";
  }

  const rimY = inverted ? y + h - 18 : y;
  ctx.fillStyle = "#17482f";
  ctx.fillRect(x - 8, rimY, w + 16, 18);
  ctx.fillStyle = "#44b86a";
  ctx.fillRect(x - 4, rimY + 3, w + 8, 7);
  ctx.fillStyle = "#d1aa5d";
  ctx.fillRect(x + 8, rimY + 5, w - 16, 8);
  ctx.fillStyle = "#926f38";
  ctx.fillRect(x + 16, rimY + 7, w - 32, 3);
}

function drawLeaves(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 1 | -1) {
  ctx.fillStyle = "#1e9a55";
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 7, direction * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + direction * 12, y - 12, 21, 7, direction * -0.74, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8be079";
  ctx.fillRect(x - 2, y - 2, 5, 4);
}

function drawBackground(ctx: CanvasRenderingContext2D, frame: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#d5f7ff");
  sky.addColorStop(0.58, "#f2ffe1");
  sky.addColorStop(1, "#c8ec98");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#ffe38a";
  ctx.fillRect(WIDTH - 88, 44, 42, 42);
  ctx.fillStyle = "#fff3b8";
  ctx.fillRect(WIDTH - 78, 54, 22, 22);

  for (let layer = 0; layer < 2; layer++) {
    const speed = layer === 0 ? 0.35 : 0.72;
    const alpha = layer === 0 ? 0.18 : 0.27;
    const color = layer === 0 ? `rgba(32, 116, 65, ${alpha})` : `rgba(24, 136, 73, ${alpha})`;
    ctx.fillStyle = color;
    for (let i = -1; i < 10; i++) {
      const bx = ((i * 72 - (frame * speed) % 72) + 72) % (WIDTH + 120) - 60;
      const base = HEIGHT - GROUND_HEIGHT;
      const h = layer === 0 ? 310 : 238;
      ctx.fillRect(bx, base - h, 10, h);
      for (let n = 0; n < h; n += 42) {
        ctx.fillRect(bx - 3, base - h + n, 16, 4);
      }
      drawLeaves(ctx, bx + 12, base - h + 58, 1);
      drawLeaves(ctx, bx - 6, base - h + 118, -1);
    }
  }

  ctx.fillStyle = "#6fb64a";
  ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
  ctx.fillStyle = "#4d963c";
  ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, 10);
  ctx.fillStyle = "#3d7e34";
  for (let i = 0; i < WIDTH; i += 18) {
    const gx = i - (frame * 1.6) % 18;
    ctx.fillRect(gx, HEIGHT - GROUND_HEIGHT + 14, 9, 4);
    ctx.fillRect(gx + 5, HEIGHT - GROUND_HEIGHT + 35, 12, 4);
  }
}

function drawScore(ctx: CanvasRenderingContext2D, score: number, best: number) {
  ctx.save();
  ctx.font = "700 34px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(18, 58, 36, 0.65)";
  ctx.strokeText(String(score), WIDTH / 2, 72);
  ctx.fillStyle = "#fff7d1";
  ctx.fillText(String(score), WIDTH / 2, 72);

  ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(24, 61, 41, 0.78)";
  ctx.fillText(`BEST ${best}`, WIDTH - 18, 28);
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState, score: number) {
  if (state === "playing") return;

  ctx.save();
  ctx.fillStyle = "rgba(9, 32, 23, 0.42)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#fff9db";
  ctx.strokeStyle = "#143321";
  ctx.lineWidth = 5;
  ctx.fillRect(42, state === "ready" ? 184 : 170, WIDTH - 84, state === "ready" ? 188 : 234);
  ctx.strokeRect(42, state === "ready" ? 184 : 170, WIDTH - 84, state === "ready" ? 188 : 234);

  ctx.textAlign = "center";
  ctx.fillStyle = "#133722";
  ctx.font = "900 30px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillText("掃福瑞", WIDTH / 2, state === "ready" ? 232 : 224);

  ctx.font = "700 17px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillStyle = "#2d6d43";

  if (state === "ready") {
    ctx.fillText("像素貓熊穿越竹林", WIDTH / 2, 268);
    ctx.fillStyle = "#17462b";
    ctx.fillText("點擊 / 空白鍵 起飛", WIDTH / 2, 314);
    ctx.font = "600 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText("避開竹子，越過空隙拿分", WIDTH / 2, 344);
  } else {
    ctx.fillText("貓熊撞到竹林啦！", WIDTH / 2, 260);
    ctx.font = "900 36px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillStyle = "#d9352a";
    ctx.fillText(String(score), WIDTH / 2, 314);
    ctx.font = "700 15px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillStyle = "#17462b";
    ctx.fillText("按 R 或點擊重新開始", WIDTH / 2, 360);
  }

  ctx.restore();
}

export function usePandaBambooGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>("ready");
  const pandaYRef = useRef(HEIGHT / 2 - 40);
  const velocityRef = useRef(0);
  const bambooRef = useRef<Bamboo[]>(makeInitialBamboo());
  const frameRef = useRef(0);
  const scoreRef = useRef(0);

  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || 0);
  });

  const syncState = (next: GameState) => {
    stateRef.current = next;
    setState(next);
  };

  const reset = () => {
    pandaYRef.current = HEIGHT / 2 - 40;
    velocityRef.current = 0;
    bambooRef.current = makeInitialBamboo();
    frameRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    syncState("ready");
  };

  const jump = () => {
    if (stateRef.current === "over") {
      reset();
      syncState("playing");
      velocityRef.current = JUMP;
      return;
    }

    if (stateRef.current === "ready") syncState("playing");
    velocityRef.current = JUMP;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    let raf = 0;

    const endGame = () => {
      if (stateRef.current === "over") return;
      syncState("over");
      const nextBest = Math.max(best, scoreRef.current);
      setBest(nextBest);
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(nextBest));
    };

    const tick = () => {
      frameRef.current += 1;
      const frame = frameRef.current;
      const currentState = stateRef.current;

      if (currentState === "playing") {
        velocityRef.current += GRAVITY;
        pandaYRef.current += velocityRef.current;

        bambooRef.current = bambooRef.current.map((b) => ({ ...b, x: b.x - GAME_SPEED }));
        const leftMost = Math.min(...bambooRef.current.map((b) => b.x));
        bambooRef.current = bambooRef.current.map((b) => {
          if (b.x + BAMBOO_WIDTH < -8) {
            return {
              id: b.id,
              x: leftMost + bambooRef.current.length * BAMBOO_SPACING,
              gapY: randomGapY(),
              passed: false,
            };
          }
          return b;
        });

        const pandaBox = {
          x: PANDA_X + 7,
          y: pandaYRef.current + 6,
          w: PANDA_SIZE - 14,
          h: PANDA_SIZE - 10,
        };

        if (pandaBox.y < 0 || pandaBox.y + pandaBox.h > HEIGHT - GROUND_HEIGHT) {
          endGame();
        }

        for (const b of bambooRef.current) {
          const topRect = { x: b.x, y: 0, w: BAMBOO_WIDTH, h: b.gapY - GAP_HEIGHT / 2 };
          const bottomRect = {
            x: b.x,
            y: b.gapY + GAP_HEIGHT / 2,
            w: BAMBOO_WIDTH,
            h: HEIGHT - GROUND_HEIGHT - (b.gapY + GAP_HEIGHT / 2),
          };

          if (rectsOverlap(pandaBox, topRect) || rectsOverlap(pandaBox, bottomRect)) {
            endGame();
          }

          if (!b.passed && b.x + BAMBOO_WIDTH < PANDA_X) {
            b.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
          }
        }
      }

      drawBackground(ctx, frame);

      for (const b of bambooRef.current) {
        const topHeight = b.gapY - GAP_HEIGHT / 2;
        const bottomY = b.gapY + GAP_HEIGHT / 2;
        const bottomHeight = HEIGHT - GROUND_HEIGHT - bottomY;
        drawBambooTrunk(ctx, b.x, 0, BAMBOO_WIDTH, topHeight, true);
        drawBambooTrunk(ctx, b.x, bottomY, BAMBOO_WIDTH, bottomHeight, false);
        drawLeaves(ctx, b.x - 2, topHeight + 28, -1);
        drawLeaves(ctx, b.x + BAMBOO_WIDTH + 2, bottomY + 44, 1);
      }

      drawPixelPanda(ctx, PANDA_X, pandaYRef.current, PANDA_SIZE, velocityRef.current);
      drawScore(ctx, scoreRef.current, best);
      drawOverlay(ctx, stateRef.current, scoreRef.current);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [best]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
        event.preventDefault();
        jump();
      }

      if (event.code === "KeyR" && stateRef.current === "over") {
        event.preventDefault();
        reset();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    canvasRef,
    jump,
    reset,
    score,
    best,
    state,
    width: WIDTH,
    height: HEIGHT,
  };
}
