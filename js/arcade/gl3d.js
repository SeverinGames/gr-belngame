// js/arcade/gl3d.js
// Minimaler, abhängigkeitsfreier WebGL2-Renderer für kleine, stilisierte
// Low-Poly-3D-Szenen (genutzt von der MAIS-MISSION). Echtes 3D: Perspektiv-
// Kamera, Tiefenpuffer, Beleuchtung, Nebel, Instancing. Keine Assets, keine
// externen Bibliotheken (lädt nichts nach), daher offline-/Render-sicher.
//
// Aufbau: Meshes (aus Dreiecken, flach schattiert, mit Vertexfarben) werden
// einmal gebaut. Instanzen (Matrix + Farbe) werden pro Frame ("dynamic")
// oder einmal ("static", z.B. Maisstauden) hochgeladen und instanziert gezeichnet.

// ------------------------------------------------------------------ Mathe
export const M4 = {
  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  },
  lookAt(o, ex, ey, ez, tx, ty, tz) {
    let zx = ex - tx, zy = ey - ty, zz = ez - tz;
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = zz, xy = 0, xz = -zx; // up = (0,1,0): x = up × z
    l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1;
    return o;
  },
  mul(o, a, b) { // o = a * b (spaltenweise gespeichert)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  // Translation * Ry * Rx * Rz * Skalierung. Konvention: Modell blickt nach -Z,
  // positives ry dreht nach RECHTS (Blick = (sin ry, 0, -cos ry)).
  trs(o, tx, ty, tz, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const cy = Math.cos(ry), sY = Math.sin(ry), cx = Math.cos(rx), sX = Math.sin(rx), cz = Math.cos(rz), sZ = Math.sin(rz);
    // Ry (Zeilen): [cy,0,-sY],[0,1,0],[sY,0,cy]   Rx: [1,0,0],[0,cx,-sX],[0,sX,cx]   Rz: [cz,-sZ,0],[sZ,cz,0],[0,0,1]
    const a = [[cy, 0, -sY], [0, 1, 0], [sY, 0, cy]], b = [[1, 0, 0], [0, cx, -sX], [0, sX, cx]], c = [[cz, -sZ, 0], [sZ, cz, 0], [0, 0, 1]];
    const mm = (p, q) => p.map((_, i) => [0, 1, 2].map((j) => p[i][0] * q[0][j] + p[i][1] * q[1][j] + p[i][2] * q[2][j]));
    const R = mm(mm(a, b), c);
    o[0] = R[0][0] * sx; o[1] = R[1][0] * sx; o[2] = R[2][0] * sx; o[3] = 0;
    o[4] = R[0][1] * sy; o[5] = R[1][1] * sy; o[6] = R[2][1] * sy; o[7] = 0;
    o[8] = R[0][2] * sz; o[9] = R[1][2] * sz; o[10] = R[2][2] * sz; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  },
};

// ------------------------------------------------------------------ Meshes
// Baut flach schattierte Körper aus Dreiecken. Normalen zeigen immer vom
// Körpermittelpunkt weg (robust gegen Windungsfehler, alle Körper sind konvex).
export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  _tri(a, b, c, color, center) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    const mx = (a[0] + b[0] + c[0]) / 3 - center[0], my = (a[1] + b[1] + c[1]) / 3 - center[1], mz = (a[2] + b[2] + c[2]) / 3 - center[2];
    if (nx * mx + ny * my + nz * mz < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; } // Windung CCW nach außen
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(color[0], color[1], color[2]); }
  }
  _xf(p, o) { // optionale Drehung um den Körpermittelpunkt, dann Verschiebung
    let [x, y, z] = p;
    if (o.rz) { const c = Math.cos(o.rz), s = Math.sin(o.rz); [x, y] = [x * c - y * s, x * s + y * c]; }
    if (o.rx) { const c = Math.cos(o.rx), s = Math.sin(o.rx); [y, z] = [y * c - z * s, y * s + z * c]; }
    if (o.ry) { const c = Math.cos(o.ry), s = Math.sin(o.ry); [x, z] = [x * c - z * s, x * s + z * c]; }
    return [x + o.cx, y + o.cy, z + o.cz];
  }
  hull(tris, o, color) { // tris: Liste von [p,p,p] in Objektkoordinaten (Mittelpunkt = Ursprung)
    const center = [o.cx, o.cy, o.cz];
    for (const t of tris) this._tri(this._xf(t[0], o), this._xf(t[1], o), this._xf(t[2], o), color, center);
    return this;
  }
  box(cx, cy, cz, sx, sy, sz, color, rot = {}) {
    const x = sx / 2, y = sy / 2, z = sz / 2;
    const v = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    const q = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
    const tris = [];
    for (const f of q) { tris.push([v[f[0]], v[f[1]], v[f[2]]], [v[f[0]], v[f[2]], v[f[3]]]); }
    return this.hull(tris, { cx, cy, cz, ...rot }, color);
  }
  // Zylinder/Kegel(stumpf): Radius unten rb, oben rt, Höhe h, n Seiten
  cyl(cx, cy, cz, rb, rt, h, n, color, rot = {}) {
    const tris = [], y0 = -h / 2, y1 = h / 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const b0 = [Math.cos(a0) * rb, y0, Math.sin(a0) * rb], b1 = [Math.cos(a1) * rb, y0, Math.sin(a1) * rb];
      const t0 = [Math.cos(a0) * rt, y1, Math.sin(a0) * rt], t1 = [Math.cos(a1) * rt, y1, Math.sin(a1) * rt];
      tris.push([b0, b1, t1], [b0, t1, t0], [[0, y0, 0], b1, b0], [[0, y1, 0], t0, t1]);
    }
    return this.hull(tris, { cx, cy, cz, ...rot }, color);
  }
  sphere(cx, cy, cz, r, color, lat = 5, lon = 8) {
    const tris = [], P = (i, j) => { const th = (i / lat) * Math.PI, ph = (j / lon) * Math.PI * 2; return [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)]; };
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { tris.push([P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]); }
    return this.hull(tris, { cx, cy, cz }, color);
  }
  // Dach (Giebelprisma): Länge l (x), Breite w (z), Höhe h; Basis unten, First oben
  roof(cx, cy, cz, l, w, h, color, rot = {}) {
    const x = l / 2, z = w / 2, y = h / 2;
    const A = [-x, -y, -z], B = [x, -y, -z], C = [x, -y, z], D = [-x, -y, z], E = [-x, y, 0], F = [x, y, 0];
    return this.hull([[A, B, F], [A, F, E], [D, C, F], [D, F, E], [A, D, E], [B, C, F], [A, B, C], [A, C, D]], { cx, cy, cz, ...rot }, color);
  }
  build() { return { pos: new Float32Array(this.pos), nor: new Float32Array(this.nor), col: new Float32Array(this.col), count: this.pos.length / 3 }; }
}

// ------------------------------------------------------------------ Shader
const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol;
layout(location=3) in vec4 iM0; layout(location=4) in vec4 iM1; layout(location=5) in vec4 iM2; layout(location=6) in vec4 iM3;
layout(location=7) in vec4 iCol;
uniform mat4 uVP; uniform vec3 uSun; uniform vec3 uCam;
out vec3 vCol; out float vDist; out float vEmis;
void main(){
  mat4 m = mat4(iM0,iM1,iM2,iM3);
  vec4 wp = m * vec4(aPos,1.0);
  vec3 n = normalize(mat3(m) * aNor);
  float diff = max(dot(n, uSun), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  float light = 0.42 + 0.30 * hemi + 0.42 * diff;
  vEmis = iCol.a;
  vCol = aCol * iCol.rgb * mix(light, 1.25, iCol.a);
  vDist = distance(wp.xyz, uCam);
  gl_Position = uVP * wp;
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 vCol; in float vDist; in float vEmis;
uniform vec3 uFog; uniform vec2 uFogRange;
out vec4 o;
void main(){
  float f = clamp((vDist - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  f *= (1.0 - vEmis * 0.7);
  o = vec4(mix(vCol, uFog, f), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("Shader: " + gl.getShaderInfoLog(s));
  return s;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("Link: " + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uVP = U("uVP"), uSun = U("uSun"), uCam = U("uCam"), uFog = U("uFog"), uFogRange = U("uFogRange");

  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  const sun = (() => { const v = [0.45, 0.85, 0.35], l = Math.hypot(...v); return v.map((x) => x / l); })();
  gl.uniform3f(uSun, sun[0], sun[1], sun[2]);

  const meshes = {};
  const batches = []; // alle Instanz-Batches (static + dynamic)

  function makeMesh(name, data) {
    const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; };
    meshes[name] = { count: data.count, pos: mk(data.pos), nor: mk(data.nor), col: mk(data.col) };
  }

  // Ein Batch = Mesh + Instanzpuffer (20 Floats: Matrix 16 + Farbe/Emission 4)
  function makeBatch(meshName, capacity, dynamic) {
    const mesh = meshes[meshName];
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const attr = (buf, loc, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    attr(mesh.pos, 0, 3); attr(mesh.nor, 1, 3); attr(mesh.col, 2, 3);
    const data = new Float32Array(capacity * 20);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    for (let k = 0; k < 5; k++) {
      gl.enableVertexAttribArray(3 + k);
      gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 80, k * 16);
      gl.vertexAttribDivisor(3 + k, 1);
    }
    const b = { mesh, vao, buf, data, capacity, count: 0, dynamic, center: null, radius: 0, visible: true,
      set(i, mat, r, g, bl, e = 0) {
        const o = i * 20; data.set(mat, o); data[o + 16] = r; data[o + 17] = g; data[o + 18] = bl; data[o + 19] = e;
      },
      upload() { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, this.count * 20); },
    };
    batches.push(b);
    return b;
  }

  const proj = new Float32Array(16), view = new Float32Array(16), vp = new Float32Array(16);
  let w = 1, h = 1;
  function resize(maxDpr = 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const cw = Math.max(1, Math.floor(canvas.clientWidth * dpr)), ch = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (cw !== canvas.width || ch !== canvas.height) { canvas.width = cw; canvas.height = ch; }
    w = cw; h = ch;
    gl.viewport(0, 0, w, h);
  }

  // cam: {x,y,z,tx,ty,tz,fov}  fog: {color:[r,g,b], near, far}
  function render(cam, fog, drawList) {
    M4.perspective(proj, cam.fov ?? 1.1, w / h, 0.1, fog.far + 30);
    M4.lookAt(view, cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz);
    M4.mul(vp, proj, view);
    gl.clearColor(fog.color[0], fog.color[1], fog.color[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uVP, false, vp);
    gl.uniform3f(uCam, cam.x, cam.y, cam.z);
    gl.uniform3f(uFog, fog.color[0], fog.color[1], fog.color[2]);
    gl.uniform2f(uFogRange, fog.near, fog.far);
    let calls = 0;
    for (const b of drawList) {
      if (!b.visible || b.count === 0) continue;
      gl.bindVertexArray(b.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, b.mesh.count, b.count);
      calls++;
    }
    return calls;
  }

  return {
    gl, makeMesh, makeBatch, resize, render,
    get size() { return { w, h }; },
    dispose() {
      try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* ignore */ }
    },
  };
}
