/**
 * Dashboard WebGL/Canvas Renderers
 * Lightweight GPU-accelerated charts for the mine management dashboard.
 * Falls back to Canvas2D if WebGL2 is unavailable.
 */

// ─── WebGL2 Sparkline ────────────────────────────────────────────
function glSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length < 2) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) { fallbackSparkline(canvas, data, color); return; }

    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Normalize data to [-1, 1] clip space
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const verts = new Float32Array(data.length * 2);
    for (let i = 0; i < data.length; i++) {
        verts[i * 2]     = (i / (data.length - 1)) * 2 - 1;
        verts[i * 2 + 1] = ((data[i] - min) / range) * 2 - 1;
    }

    // Shaders
    const vsrc = `#version 300 es
    in vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;
    const fsrc = `#version 300 es
    precision mediump float;
    uniform vec4 u_color;
    out vec4 fragColor;
    void main() { fragColor = u_color; }`;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsrc); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsrc); gl.compileShader(fs);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog); gl.useProgram(prog);

    // Buffer
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // Color uniform (parse hex)
    const r = parseInt(color.slice(1,3),16)/255;
    const g = parseInt(color.slice(3,5),16)/255;
    const b = parseInt(color.slice(5,7),16)/255;
    gl.uniform4f(gl.getUniformLocation(prog, 'u_color'), r, g, b, 1.0);

    gl.lineWidth(2.0);
    gl.drawArrays(gl.LINE_STRIP, 0, data.length);

    // Cleanup
    gl.deleteShader(vs); gl.deleteShader(fs);
    gl.deleteProgram(prog); gl.deleteBuffer(buf);
}

// Canvas2D fallback
function fallbackSparkline(canvas, data, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

// ─── WebGL2 Bar Chart (Gate Scans per Hour) ──────────────────────
function glBarChart(canvasId, labels, values, barColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) { fallbackBarChart(canvas, labels, values, barColor); return; }

    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!values || values.length === 0) return;
    const maxVal = Math.max(...values) || 1;
    const n = values.length;
    const barW = 2.0 / n * 0.7;
    const gap = 2.0 / n * 0.3;

    // Build quads
    const verts = [];
    for (let i = 0; i < n; i++) {
        const x = -1 + (2.0 / n) * i + gap / 2;
        const barH = (values[i] / maxVal) * 1.8;
        // Two triangles per bar
        verts.push(x, -0.9,  x + barW, -0.9,  x, -0.9 + barH);
        verts.push(x + barW, -0.9,  x + barW, -0.9 + barH,  x, -0.9 + barH);
    }

    const vsrc = `#version 300 es
    in vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;
    const fsrc = `#version 300 es
    precision mediump float;
    uniform vec4 u_color;
    out vec4 fragColor;
    void main() { fragColor = u_color; }`;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsrc); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsrc); gl.compileShader(fs);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const r = parseInt(barColor.slice(1,3),16)/255;
    const g = parseInt(barColor.slice(3,5),16)/255;
    const b = parseInt(barColor.slice(5,7),16)/255;
    gl.uniform4f(gl.getUniformLocation(prog, 'u_color'), r, g, b, 0.85);

    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 2);

    gl.deleteShader(vs); gl.deleteShader(fs);
    gl.deleteProgram(prog); gl.deleteBuffer(buf);

    // Draw labels overlay with 2D
    const ctx2d = document.getElementById(canvasId + 'Labels');
    if (ctx2d) {
        const c = ctx2d.getContext('2d');
        c.clearRect(0, 0, ctx2d.width, ctx2d.height);
        c.font = '10px Inter, sans-serif';
        c.fillStyle = '#888';
        c.textAlign = 'center';
        const step = ctx2d.width / n;
        labels.forEach((l, i) => {
            if (i % Math.ceil(n / 12) === 0) {
                c.fillText(l, step * i + step / 2, ctx2d.height - 2);
            }
        });
    }
}

// Canvas2D bar chart fallback
function fallbackBarChart(canvas, labels, values, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d0d12';
    ctx.fillRect(0, 0, w, h);

    if (!values || values.length === 0) return;
    const maxVal = Math.max(...values) || 1;
    const n = values.length;
    const barW = (w / n) * 0.7;
    const gap = (w / n) * 0.3;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    values.forEach((v, i) => {
        const x = (w / n) * i + gap / 2;
        const barH = (v / maxVal) * (h - 20);
        ctx.fillRect(x, h - 15 - barH, barW, barH);
    });

    ctx.globalAlpha = 1;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    const step = w / n;
    labels.forEach((l, i) => {
        if (i % Math.ceil(n / 12) === 0) {
            ctx.fillText(l, step * i + step / 2, h - 2);
        }
    });
}

// ─── Live On-Site Gauge ──────────────────────────────────────────
function drawOnSiteGauge(canvasId, current, capacity) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2 + 10;
    const radius = Math.min(w, h) / 2 - 15;
    const pct = Math.min(1, current / (capacity || 1));

    ctx.clearRect(0, 0, w, h);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI, false);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 12;
    ctx.stroke();

    // Value arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, Math.PI + pct * Math.PI, false);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4caf50');
    grad.addColorStop(0.7, '#ff9800');
    grad.addColorStop(1, '#f44336');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(current, cx, cy - 5);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('ON SITE', cx, cy + 15);
}
