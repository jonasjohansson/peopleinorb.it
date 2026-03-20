import { Pane } from "https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js";

// --- Constants ---
const IMG_W = 8192;
const IMG_H = 5464;
const IMG_RATIO = IMG_W / IMG_H;

const SPOTIFY_EMBED_URL =
  "https://open.spotify.com/embed/artist/39Hqg9HOVrra5TX0mdsj4N?utm_source=generator&theme=0";

// --- State ---
let isPlaying = false;
let isDark = false;
let noteInterval = null;
let mouseX = 0.5;
let mouseY = 0.5;
let targetMouseX = 0.5;
let targetMouseY = 0.5;

// --- Elements ---
const bgImage = document.getElementById("bgImage");
const bgImageDusk = document.getElementById("bgImageDusk");
const hotspotLayer = document.getElementById("hotspotLayer");
const fxCanvas = document.getElementById("fxCanvas");
const turntableBtn = document.getElementById("turntableBtn");
const musicNotes = document.getElementById("musicNotes");
const tvBtn = document.getElementById("tvBtn");
const tvStatic = document.getElementById("tvStatic");
const staticCanvas = document.getElementById("staticCanvas");
const lampBtn = document.getElementById("lampBtn");
const speakerLeft = document.getElementById("speakerLeft");
const speakerRight = document.getElementById("speakerRight");
const spotifyPlayer = document.getElementById("spotifyPlayer");
const spotifyFrame = document.getElementById("spotifyFrame");
const spotifyClose = document.getElementById("spotifyClose");
const tvScreen = document.getElementById("tvScreen");

// --- FX Parameters ---
const fx = {
  vignette: 0.4,
  vignetteSize: 0.45,
  tintR: 1.0,
  tintG: 0.95,
  tintB: 0.9,
  grain: 0.08,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  depthLightIntensity: 0.3,
  depthLightRadius: 0.4,
  depthScale: 1.5,
  ambientLight: 0.15,
};

// ============================================================
// Hotspot Regions (% of image) — editable via corner anchors
// ============================================================
const hotspots = {
  tv:        { left: 14.7, top: 67.7, width: 28.0, height: 23.5, color: "#00ff00", el: null, screenEl: tvScreen },
  turntable: { left: 48.0, top: 64.0, width: 18.1, height: 6.2,  color: "#ff4444", el: turntableBtn },
  vinyl:     { left: 72.4, top: 51.8, width: 12.2, height: 14.5, color: "#4444ff", el: document.getElementById("vinylBtn") },
  lamp:      { left: 73.7, top: 29.5, width: 10.8, height: 15.5, color: "#ffaa00", el: lampBtn },
  speakerL:  { left: 47.7, top: 76.5, width: 7.3,  height: 18.1, color: "#ff66ff", el: speakerLeft },
  speakerR:  { left: 63.4, top: 76.1, width: 7.6,  height: 18.4, color: "#66ffff", el: speakerRight },
};

function syncHotspot(name) {
  const h = hotspots[name];
  if (h.el) {
    h.el.style.left = h.left + "%";
    h.el.style.top = h.top + "%";
    h.el.style.width = h.width + "%";
    h.el.style.height = h.height + "%";
  }
  if (h.screenEl) {
    h.screenEl.style.left = h.left + "%";
    h.screenEl.style.top = h.top + "%";
    h.screenEl.style.width = h.width + "%";
    h.screenEl.style.height = h.height + "%";
  }
  // Also sync the TV clickable area to match the screen
  if (name === "tv") {
    tvBtn.style.left = h.left + "%";
    tvBtn.style.top = h.top + "%";
    tvBtn.style.width = h.width + "%";
    tvBtn.style.height = h.height + "%";
  }
}

// Initial sync
Object.keys(hotspots).forEach(syncHotspot);

// ============================================================
// Draggable Corner Anchors
// ============================================================
let editMode = false;
const anchors = []; // all anchor elements

function createAnchors() {
  // Remove existing
  anchors.forEach((a) => a.remove());
  anchors.length = 0;

  if (!editMode) return;

  Object.entries(hotspots).forEach(([name, h]) => {
    // 4 corners: TL, TR, BL, BR
    const corners = [
      { cx: "left", cy: "top", cursor: "nw-resize" },
      { cx: "right", cy: "top", cursor: "ne-resize" },
      { cx: "left", cy: "bottom", cursor: "sw-resize" },
      { cx: "right", cy: "bottom", cursor: "se-resize" },
    ];

    corners.forEach((corner) => {
      const dot = document.createElement("div");
      dot.className = "anchor-dot";
      dot.style.background = h.color;
      dot.style.borderColor = h.color;
      dot.dataset.hotspot = name;
      dot.dataset.cx = corner.cx;
      dot.dataset.cy = corner.cy;
      dot.style.cursor = corner.cursor;
      hotspotLayer.appendChild(dot);
      anchors.push(dot);

      positionAnchor(dot, name, corner.cx, corner.cy);

      // Drag logic
      let dragging = false;

      dot.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;

        const onMove = (e2) => {
          if (!dragging) return;
          const layerRect = hotspotLayer.getBoundingClientRect();
          const pctX = ((e2.clientX - layerRect.left) / layerRect.width) * 100;
          const pctY = ((e2.clientY - layerRect.top) / layerRect.height) * 100;

          if (corner.cx === "left") {
            const right = h.left + h.width;
            h.left = Math.max(0, Math.min(pctX, right - 1));
            h.width = right - h.left;
          } else {
            h.width = Math.max(1, pctX - h.left);
          }

          if (corner.cy === "top") {
            const bottom = h.top + h.height;
            h.top = Math.max(0, Math.min(pctY, bottom - 1));
            h.height = bottom - h.top;
          } else {
            h.height = Math.max(1, pctY - h.top);
          }

          syncHotspot(name);
          updateAllAnchors(name);
          // Update Tweakpane
          pane.refresh();
        };

        const onUp = () => {
          dragging = false;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          console.log(`${name}:`, JSON.stringify({ left: +h.left.toFixed(1), top: +h.top.toFixed(1), width: +h.width.toFixed(1), height: +h.height.toFixed(1) }));
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    });
  });
}

function positionAnchor(dot, name, cx, cy) {
  const h = hotspots[name];
  const x = cx === "left" ? h.left : h.left + h.width;
  const y = cy === "top" ? h.top : h.top + h.height;
  dot.style.left = x + "%";
  dot.style.top = y + "%";
}

function updateAllAnchors(name) {
  anchors
    .filter((a) => a.dataset.hotspot === name)
    .forEach((a) => positionAnchor(a, a.dataset.hotspot, a.dataset.cx, a.dataset.cy));
}

// ============================================================
// Image Bounds (object-fit: cover)
// ============================================================
function getImageBounds() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewRatio = vw / vh;
  let renderedW, renderedH, offsetX, offsetY;

  if (viewRatio > IMG_RATIO) {
    renderedW = vw;
    renderedH = vw / IMG_RATIO;
  } else {
    renderedH = vh;
    renderedW = vh * IMG_RATIO;
  }

  offsetX = (vw - renderedW) / 2;
  offsetY = (vh - renderedH) / 2;
  return { renderedW, renderedH, offsetX, offsetY };
}

function syncHotspotLayer() {
  const { renderedW, renderedH, offsetX, offsetY } = getImageBounds();
  hotspotLayer.style.width = renderedW + "px";
  hotspotLayer.style.height = renderedH + "px";
  hotspotLayer.style.left = offsetX + "px";
  hotspotLayer.style.top = offsetY + "px";
}

syncHotspotLayer();
window.addEventListener("resize", () => {
  syncHotspotLayer();
  resizeGL();
});

// --- Mouse tracking (smooth) ---
window.addEventListener("mousemove", (e) => {
  targetMouseX = e.clientX / window.innerWidth;
  targetMouseY = e.clientY / window.innerHeight;
});

// ============================================================
// WebGL Post-Processing with Depth Map
// ============================================================
const gl = fxCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });

const vertSrc = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const fragSrc = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_depth;
  uniform vec2 u_mouse;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_vignette;
  uniform float u_vignetteSize;
  uniform vec3 u_tint;
  uniform float u_grain;
  uniform float u_depthLightIntensity;
  uniform float u_depthLightRadius;
  uniform float u_depthScale;
  uniform float u_ambientLight;
  uniform vec4 u_imageBounds;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = v_uv;
    // Flip Y: WebGL v_uv has Y=0 at bottom, but screen/CSS has Y=0 at top
    vec2 screenUV = vec2(uv.x, 1.0 - uv.y);
    vec2 pixelPos = screenUV * u_resolution;
    vec2 imgUV = (pixelPos - u_imageBounds.xy) / u_imageBounds.zw;
    vec4 color = vec4(0.0);

    if (imgUV.x >= 0.0 && imgUV.x <= 1.0 && imgUV.y >= 0.0 && imgUV.y <= 1.0) {
      float texelX = 1.0 / u_resolution.x * 2.0;
      float texelY = 1.0 / u_resolution.y * 2.0;
      float dL = texture2D(u_depth, imgUV + vec2(-texelX, 0.0)).r;
      float dR = texture2D(u_depth, imgUV + vec2( texelX, 0.0)).r;
      float dU = texture2D(u_depth, imgUV + vec2(0.0, -texelY)).r;
      float dD = texture2D(u_depth, imgUV + vec2(0.0,  texelY)).r;

      vec3 normal = normalize(vec3(
        (dL - dR) * u_depthScale,
        (dU - dD) * u_depthScale,
        1.0
      ));

      vec2 lightPos = vec2(u_mouse.x, 1.0 - u_mouse.y);
      vec3 lightDir = normalize(vec3(
        (lightPos.x - screenUV.x) * (u_resolution.x / u_resolution.y),
        lightPos.y - screenUV.y,
        0.35
      ));

      float dist = length(screenUV - lightPos);
      float atten = 1.0 - smoothstep(0.0, u_depthLightRadius, dist);
      float diffuse = max(dot(normal, lightDir), 0.0);
      float lighting = (diffuse * atten * u_depthLightIntensity) + u_ambientLight;
      vec3 lightColor = vec3(1.0, 0.92, 0.82) * lighting;
      color = vec4(lightColor, lighting * 0.6);
    }

    if (u_vignette > 0.0) {
      vec2 vc = screenUV - 0.5;
      float vDist = length(vc);
      float vFade = smoothstep(u_vignetteSize, 0.9, vDist);
      color.rgb -= vec3(vFade * u_vignette);
      color.a = max(color.a, vFade * u_vignette);
    }

    vec3 tintOffset = (u_tint - 1.0) * 0.15;
    color.rgb += tintOffset;
    color.a = max(color.a, length(tintOffset) * 0.5);

    if (u_grain > 0.0) {
      float grainVal = hash(uv * u_resolution + u_time * 100.0) - 0.5;
      color.rgb += vec3(grainVal * u_grain);
      color.a = max(color.a, abs(grainVal) * u_grain);
    }

    gl_FragColor = color;
  }
`;

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
  }
  return s;
}

const vs = compileShader(gl.VERTEX_SHADER, vertSrc);
const fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);
const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, "a_pos");
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uMouse = gl.getUniformLocation(prog, "u_mouse");
const uRes = gl.getUniformLocation(prog, "u_resolution");
const uTime = gl.getUniformLocation(prog, "u_time");
const uVignette = gl.getUniformLocation(prog, "u_vignette");
const uVignetteSize = gl.getUniformLocation(prog, "u_vignetteSize");
const uTint = gl.getUniformLocation(prog, "u_tint");
const uGrain = gl.getUniformLocation(prog, "u_grain");
const uDepthLightIntensity = gl.getUniformLocation(prog, "u_depthLightIntensity");
const uDepthLightRadius = gl.getUniformLocation(prog, "u_depthLightRadius");
const uDepthScale = gl.getUniformLocation(prog, "u_depthScale");
const uAmbientLight = gl.getUniformLocation(prog, "u_ambientLight");
const uImageBounds = gl.getUniformLocation(prog, "u_imageBounds");

const depthTex = gl.createTexture();
const depthImg = new Image();
depthImg.crossOrigin = "anonymous";
depthImg.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, depthTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthImg);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
};
depthImg.src = "assets/pio-depth.png";

function resizeGL() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  fxCanvas.width = w;
  fxCanvas.height = h;
  gl.viewport(0, 0, w, h);
}
resizeGL();

function render(time) {
  mouseX += (targetMouseX - mouseX) * 0.08;
  mouseY += (targetMouseY - mouseY) * 0.08;

  bgImage.style.filter = `brightness(${fx.brightness}) contrast(${fx.contrast}) saturate(${fx.saturation})`;

  const { renderedW, renderedH, offsetX, offsetY } = getImageBounds();

  gl.uniform2f(uMouse, mouseX, mouseY);
  gl.uniform2f(uRes, fxCanvas.width, fxCanvas.height);
  gl.uniform1f(uTime, time * 0.001);
  gl.uniform1f(uVignette, fx.vignette);
  gl.uniform1f(uVignetteSize, fx.vignetteSize);
  gl.uniform3f(uTint, fx.tintR, fx.tintG, fx.tintB);
  gl.uniform1f(uGrain, fx.grain);
  gl.uniform1f(uDepthLightIntensity, fx.depthLightIntensity);
  gl.uniform1f(uDepthLightRadius, fx.depthLightRadius);
  gl.uniform1f(uDepthScale, fx.depthScale);
  gl.uniform1f(uAmbientLight, fx.ambientLight);
  gl.uniform4f(uImageBounds, offsetX, offsetY, renderedW, renderedH);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, depthTex);
  gl.uniform1i(gl.getUniformLocation(prog, "u_depth"), 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ============================================================
// Tweakpane GUI
// ============================================================
const pane = new Pane({ title: "Post FX", expanded: false });

const fVignette = pane.addFolder({ title: "Vignette" });
fVignette.addBinding(fx, "vignette", { min: 0, max: 1, step: 0.01, label: "Intensity" });
fVignette.addBinding(fx, "vignetteSize", { min: 0.1, max: 0.8, step: 0.01, label: "Size" });

const fColor = pane.addFolder({ title: "Color" });
fColor.addBinding(fx, "brightness", { min: 0.5, max: 1.5, step: 0.01 });
fColor.addBinding(fx, "contrast", { min: 0.5, max: 1.5, step: 0.01 });
fColor.addBinding(fx, "saturation", { min: 0, max: 2, step: 0.01 });
fColor.addBinding(fx, "tintR", { min: 0.5, max: 1.5, step: 0.01, label: "Tint R" });
fColor.addBinding(fx, "tintG", { min: 0.5, max: 1.5, step: 0.01, label: "Tint G" });
fColor.addBinding(fx, "tintB", { min: 0.5, max: 1.5, step: 0.01, label: "Tint B" });

const fEffects = pane.addFolder({ title: "Effects" });
fEffects.addBinding(fx, "grain", { min: 0, max: 0.3, step: 0.01, label: "Film Grain" });

const fDepth = pane.addFolder({ title: "Depth Lighting" });
fDepth.addBinding(fx, "depthLightIntensity", { min: 0, max: 1, step: 0.01, label: "Intensity" });
fDepth.addBinding(fx, "depthLightRadius", { min: 0.1, max: 1.0, step: 0.01, label: "Radius" });
fDepth.addBinding(fx, "depthScale", { min: 0.1, max: 5.0, step: 0.1, label: "Normal Scale" });
fDepth.addBinding(fx, "ambientLight", { min: 0, max: 0.5, step: 0.01, label: "Ambient" });

// --- Hotspot Layout Editor ---
const fLayout = pane.addFolder({ title: "Layout Editor" });
const editState = { editMode: false };
fLayout.addBinding(editState, "editMode", { label: "Edit Hotspots" }).on("change", (e) => {
  editMode = e.value;
  createAnchors();
});

// Add per-hotspot folders with numeric inputs
Object.entries(hotspots).forEach(([name, h]) => {
  const f = fLayout.addFolder({ title: name, expanded: false });
  f.addBinding(h, "left",   { min: 0, max: 100, step: 0.1, label: "Left %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
  f.addBinding(h, "top",    { min: 0, max: 100, step: 0.1, label: "Top %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
  f.addBinding(h, "width",  { min: 1, max: 100, step: 0.1, label: "Width %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
  f.addBinding(h, "height", { min: 1, max: 100, step: 0.1, label: "Height %" }).on("change", () => { syncHotspot(name); if (editMode) updateAllAnchors(name); });
});

// Export button — logs all values to console
fLayout.addButton({ title: "Log All Positions" }).on("click", () => {
  const out = {};
  Object.entries(hotspots).forEach(([name, h]) => {
    out[name] = { left: +h.left.toFixed(1), top: +h.top.toFixed(1), width: +h.width.toFixed(1), height: +h.height.toFixed(1) };
  });
  console.log("Hotspot positions:", JSON.stringify(out, null, 2));
});

// ============================================================
// Interactive Features
// ============================================================

// --- Turntable ---
turntableBtn.addEventListener("click", () => {
  if (editMode) return; // don't trigger actions in edit mode
  isPlaying = !isPlaying;
  if (isPlaying) {
    spotifyFrame.src = SPOTIFY_EMBED_URL;
    spotifyPlayer.style.display = "block";
    requestAnimationFrame(() => spotifyPlayer.classList.add("visible"));
    turntableBtn.classList.add("playing");
    speakerLeft.classList.add("pulsing");
    speakerRight.classList.add("pulsing");
    spawnNote();
    noteInterval = setInterval(spawnNote, 800);
  } else {
    stopPlaying();
  }
});

spotifyClose.addEventListener("click", (e) => {
  e.stopPropagation();
  stopPlaying();
});

function stopPlaying() {
  isPlaying = false;
  spotifyPlayer.classList.remove("visible");
  setTimeout(() => {
    spotifyPlayer.style.display = "none";
    spotifyFrame.src = "";
  }, 400);
  turntableBtn.classList.remove("playing");
  speakerLeft.classList.remove("pulsing");
  speakerRight.classList.remove("pulsing");
  clearInterval(noteInterval);
  noteInterval = null;
}

// --- Music Notes ---
const noteChars = ["♪", "♫", "♩", "♬"];
function spawnNote() {
  const note = document.createElement("span");
  note.className = "music-note";
  note.textContent = noteChars[Math.floor(Math.random() * noteChars.length)];
  note.style.left = Math.random() * 80 + 10 + "%";
  note.style.setProperty("--drift", (Math.random() - 0.5) * 40 + "px");
  note.style.setProperty("--rotate", (Math.random() - 0.5) * 60 + "deg");
  note.style.animationDelay = Math.random() * 0.3 + "s";
  musicNotes.appendChild(note);
  note.addEventListener("animationend", () => note.remove());
}

// --- Lamp: crossfade to dusk photo ---
lampBtn.addEventListener("click", () => {
  if (editMode) return;
  isDark = !isDark;
  bgImageDusk.classList.toggle("active", isDark);
});

// --- TV Static ---
function drawStatic() {
  const ctx = staticCanvas.getContext("2d");
  const w = (staticCanvas.width = 200);
  const h = (staticCanvas.height = 150);
  function renderFrame() {
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 180;
    }
    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(renderFrame);
  }
  renderFrame();
}
drawStatic();

tvBtn.addEventListener("click", () => {
  if (editMode) return;
  const isVisible = tvStatic.style.display !== "none";
  tvStatic.style.display = isVisible ? "none" : "block";
});

// --- ESC ---
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isPlaying) stopPlaying();
});
