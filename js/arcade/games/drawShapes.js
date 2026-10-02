// js/arcade/games/drawShapes.js - Formvorlagen + Bewertung (rein, testbar) für "Form Zeichnen".
//
// Bewertung (positions-/größenunabhängig, Strichreihenfolge egal):
//  1. Die Zeichnung wird so skaliert/verschoben, dass sie auf die Vorlage passt
//     (Seitenverhältnis bleibt erhalten -> Rechteck != Quadrat).
//  2. Genauigkeit: mittlerer Abstand der gezeichneten Punkte zur Vorlagenlinie.
//  3. Vollständigkeit: mittlerer Abstand der Vorlagenpunkte zur Zeichnung
//     (fehlende Linien werden dadurch bestraft).
//  Aus beidem entsteht die Genauigkeit in % (je Schwierigkeit unterschiedlich streng).
const P = (pts) => pts.map(([x, y]) => ({ x, y }));
const circle = (n = 64) => P(Array.from({ length: n + 1 }, (_, i) => [0.5 + 0.5 * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2), 0.5 + 0.5 * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)]));
const polar = (rs, off = -Math.PI / 2) => rs.map(([r, a]) => [0.5 + 0.5 * r * Math.cos(a + off), 0.5 + 0.5 * r * Math.sin(a + off)]);
const starPts = () => { const pts = []; for (let i = 0; i < 10; i++) pts.push([i % 2 ? 0.42 : 1, (i / 10) * Math.PI * 2]); pts.push(pts[0]); return P(polar(pts)); };
const pentagram = () => { const v = [0, 2, 4, 1, 3, 0].map((k) => [1, (k / 5) * Math.PI * 2]); return P(polar(v)); };
const hexagon = () => P(polar([...Array(7)].map((_, i) => [1, (i / 6) * Math.PI * 2])));
const heart = () => { const pts = []; for (let i = 0; i <= 80; i++) { const t = (i / 80) * Math.PI * 2; pts.push([16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys); const s = Math.max(maxX - minX, maxY - minY); return P(pts.map(([x, y]) => [(x - minX) / s, (y - minY) / s])); };

export const SHAPES = {
  square: { name: "Quadrat", icon: "■", closed: true, pts: P([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]) },
  rectangle: { name: "Rechteck", icon: "▬", closed: true, pts: P([[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]) },
  triangle: { name: "Dreieck", icon: "▲", closed: true, pts: P([[0.5, 0], [1, 0.87], [0, 0.87], [0.5, 0]]) },
  rhombus: { name: "Raute", icon: "◆", closed: true, pts: P([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]]) },
  circle: { name: "Kreis", icon: "●", closed: true, pts: circle() },
  star: { name: "Stern", icon: "★", closed: true, pts: starPts() },
  hexagon: { name: "Sechseck", icon: "⬡", closed: true, pts: hexagon() },
  heart: { name: "Herz", icon: "♥", closed: true, pts: heart() },
  arrow: { name: "Pfeil", icon: "➤", closed: true, pts: P([[0, 0.35], [0.55, 0.35], [0.55, 0], [1, 0.5], [0.55, 1], [0.55, 0.65], [0, 0.65], [0, 0.35]]) },
  bolt: { name: "Blitz", icon: "⚡", closed: true, pts: P([[0.6, 0], [0.1, 0.55], [0.45, 0.55], [0.3, 1], [0.9, 0.4], [0.55, 0.4], [0.6, 0]]) },
  pentagram: { name: "Drudenfuß", icon: "✯", closed: true, pts: pentagram() },
  // Haus des Nikolaus: A(0,1) B(1,1) D(1,.4) C(0,.4) E(.5,0) - ein Zug über alle 8 Linien
  nikolaus: { name: "Haus des Nikolaus", icon: "🏠", closed: false, pts: P([[0, 1], [1, 1], [1, 0.4], [0, 0.4], [0, 1], [1, 0.4], [0.5, 0], [0, 0.4], [1, 1]]) },
};
export const POOLS = {
  easy: ["square", "triangle", "rectangle", "square", "triangle", "rectangle"],
  normal: ["circle", "star", "hexagon", "heart", "rhombus", "arrow"],
  hard: ["nikolaus", "pentagram", "bolt", "heart", "nikolaus", "star"],
};
export const STRICT = { easy: 0.17, normal: 0.14, hard: 0.115 }; // Toleranz (Anteil der Formgröße), kleiner = strenger

export function resample(pts, n) {
  if (pts.length < 2) return pts.slice();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1] || 1, out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    while (j < cum.length - 1 && cum[j] < d) j++;
    const seg = cum[j] - cum[j - 1] || 1, u = (d - cum[j - 1]) / seg;
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u });
  }
  return out;
}
const bbox = (pts) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); } return { x0: a, y0: b, x1: c, y1: d, w: c - a, h: d - b }; };
function distToPolyline(p, line) {
  let best = 1e9;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}
// strokes: Liste von Strichen (je Liste von {x,y} in Pixeln). Rückgabe: { percent, accuracy, coverage, reason }
export function scoreDrawing(shapeId, strokes, difficulty = "normal") {
  const shape = SHAPES[shapeId], tol = STRICT[difficulty] ?? STRICT.normal;
  const all = strokes.flat();
  if (all.length < 8) return { percent: 0, reason: "zu wenig gezeichnet" };
  const db = bbox(all), tb = bbox(shape.pts);
  const dMax = Math.max(db.w, db.h);
  if (dMax < 30) return { percent: 0, reason: "zu klein" };
  const scale = Math.max(tb.w, tb.h) / dMax;
  const norm = (p) => ({ x: (p.x - (db.x0 + db.w / 2)) * scale + (tb.x0 + tb.w / 2), y: (p.y - (db.y0 + db.h / 2)) * scale + (tb.y0 + tb.h / 2) });
  const drawn = strokes.filter((s) => s.length > 1).map((s) => s.map(norm));
  if (!drawn.length) return { percent: 0, reason: "zu wenig gezeichnet" };
  const size = Math.max(tb.w, tb.h);
  // gezeichnete Punkte (gleichmäßig verteilt) -> Abstand zur Vorlage
  const dsamp = drawn.flatMap((s) => resample(s, Math.max(10, Math.round(120 / drawn.length))));
  const e1 = dsamp.reduce((a, p) => a + distToPolyline(p, shape.pts), 0) / dsamp.length / size;
  // Vorlagenpunkte -> Abstand zur Zeichnung (jeder Strich einzeln, kleinster Abstand zählt)
  const tsamp = resample(shape.pts, 160);
  const e2 = tsamp.reduce((a, p) => a + Math.min(...drawn.map((s) => distToPolyline(p, s))), 0) / tsamp.length / size;
  const err = 0.5 * (e1 + e2) + 0.5 * Math.max(e1, e2);
  // Fehlende Linien (Vorlage nicht abgedeckt) und überflüssige Striche (weit weg) kosten extra
  const missing = tsamp.filter((p) => Math.min(...drawn.map((s) => distToPolyline(p, s))) > 0.09 * size).length / tsamp.length;
  const stray = dsamp.filter((p) => distToPolyline(p, shape.pts) > 0.13 * size).length / dsamp.length;
  let percent = 100 * (1 - err / tol) - missing * 90 - stray * 120;
  // geschlossene Formen sollten auch geschlossen sein
  if (shape.closed) {
    const first = drawn[0][0], lastS = drawn[drawn.length - 1], last = lastS[lastS.length - 1];
    const gap = Math.hypot(first.x - last.x, first.y - last.y) / size;
    if (gap > 0.15) percent -= Math.min(15, (gap - 0.15) * 40);
  }
  percent = Math.max(0, Math.min(100, Math.round(percent)));
  return { percent, accuracy: Math.max(0, Math.round(100 * (1 - e1 / tol))), coverage: Math.max(0, Math.round(100 * (1 - missing))) };
}
