import JSZip from "jszip";

const PX_W = 1920;
const PX_H = 1080;

type Box = { x: number; y: number; w: number; h: number; rot: number };

export async function rasterPptxSlide(buffer: ArrayBuffer, slideNumber: number): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = listSlides(zip);
  const path = slides[slideNumber - 1];
  if (!path) throw new Error("slide");
  return drawSlide(zip, path);
}

export async function rasterPptxDeck(
  buffer: ArrayBuffer,
  onSlide?: (current: number, total: number) => void,
): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = listSlides(zip);
  const out: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    onSlide?.(i + 1, slides.length);
    out.push(await drawSlide(zip, slides[i]));
  }
  return out;
}

function listSlides(zip: JSZip) {
  return Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] ?? 0) - Number(b.match(/slide(\d+)/i)?.[1] ?? 0));
}

async function drawSlide(zip: JSZip, slidePath: string): Promise<string> {
  const size = await readSlideSize(zip);
  const canvas = document.createElement("canvas");
  canvas.width = PX_W;
  canvas.height = Math.round((PX_W * size.cy) / size.cx) || PX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / size.cx;
  const scaleY = canvas.height / size.cy;
  const toBox = (xfrm: Box) => ({
    x: xfrm.x * scaleX,
    y: xfrm.y * scaleY,
    w: xfrm.w * scaleX,
    h: xfrm.h * scaleY,
    rot: xfrm.rot,
  });

  const slideXml = await zip.file(slidePath)!.async("string");
  const slideRels = await readRels(zip, relsPath(slidePath));
  const layoutRel = slideRels.get(targetByType(slideRels, "slideLayout"));
  const layoutPath = layoutRel ? resolveRel(slidePath, layoutRel.target) : "";
  const layoutXml = layoutPath ? await zip.file(layoutPath)?.async("string") : undefined;
  const layoutRels = layoutPath ? await readRels(zip, relsPath(layoutPath)) : new Map<string, Rel>();
  const masterRel = layoutPath ? layoutRels.get(targetByType(layoutRels, "slideMaster")) : undefined;
  const masterPath = masterRel && layoutPath ? resolveRel(layoutPath, masterRel.target) : "";
  const masterXml = masterPath ? await zip.file(masterPath)?.async("string") : undefined;
  const masterRels = masterPath ? await readRels(zip, relsPath(masterPath)) : new Map<string, Rel>();

  const bg =
    parseBackground(slideXml) || parseBackground(layoutXml ?? "") || parseBackground(masterXml ?? "") || "#ffffff";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await paintTree(ctx, zip, masterXml ?? "", masterRels, masterPath, toBox, true);
  await paintTree(ctx, zip, layoutXml ?? "", layoutRels, layoutPath ?? "", toBox, true);
  await paintTree(ctx, zip, slideXml, slideRels, slidePath, toBox, false);

  return canvas.toDataURL("image/png");
}

type Rel = { id: string; target: string; type: string };

async function readRels(zip: JSZip, path: string) {
  const map = new Map<string, Rel>();
  const xml = await zip.file(path)?.async("string");
  if (!xml) return map;
  for (const m of xml.matchAll(/<Relationship\b([^>]+)>/g)) {
    const id = attr(m[1], "Id");
    const target = attr(m[1], "Target");
    const type = attr(m[1], "Type");
    if (id && target) map.set(id, { id, target, type });
  }
  return map;
}

function targetByType(rels: Map<string, Rel>, kind: string) {
  for (const rel of rels.values()) {
    if (rel.type.toLowerCase().includes(kind.toLowerCase())) return rel.id;
  }
  return "";
}

function relsPath(xmlPath: string) {
  const i = xmlPath.lastIndexOf("/");
  return `${xmlPath.slice(0, i)}/_rels/${xmlPath.slice(i + 1)}.rels`;
}

function resolveRel(fromXml: string, target: string) {
  if (!target) return "";
  if (target.startsWith("/")) return target.replace(/^\//, "");
  const base = fromXml.slice(0, fromXml.lastIndexOf("/") + 1);
  const parts = (base + target).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === ".." ) out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

async function readSlideSize(zip: JSZip) {
  const xml = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const tag = xml.match(/<p:sldSz\b[^>]*>/)?.[0] ?? "";
  const cx = Number(attr(tag, "cx") || 12192000);
  const cy = Number(attr(tag, "cy") || 6858000);
  return { cx, cy };
}

function parseBackground(xml: string) {
  const bg = xml.match(/<p:bg\b[\s\S]*?<\/p:bg>/)?.[0] ?? xml.match(/<p:bgPr\b[\s\S]*?<\/p:bgPr>/)?.[0] ?? "";
  return parseSolidColor(bg);
}

function parseSolidColor(xml: string) {
  const rgb = xml.match(/<a:srgbClr[^>]*val="([A-Fa-f0-9]{6})"/)?.[1];
  if (rgb) return `#${rgb}`;
  return null;
}

async function paintTree(
  ctx: CanvasRenderingContext2D,
  zip: JSZip,
  xml: string,
  rels: Map<string, Rel>,
  xmlPath: string,
  toBox: (b: Box) => Box,
  skipText: boolean,
) {
  if (!xml) return;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const spTree = doc.getElementsByTagName("p:spTree")[0];
  if (!spTree) return;
  await paintChildren(ctx, zip, spTree, rels, xmlPath, toBox, skipText, null);
}

async function paintChildren(
  ctx: CanvasRenderingContext2D,
  zip: JSZip,
  parent: Element,
  rels: Map<string, Rel>,
  xmlPath: string,
  toBox: (b: Box) => Box,
  skipText: boolean,
  group: { off: Box; chOff: Box; chExt: Box } | null,
) {
  for (const child of Array.from(parent.children)) {
    const tag = child.localName;
    if (tag === "grpSp") {
      const xfrm = readXfrm(child) ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
      const ch = readChildXfrm(child);
      await paintChildren(ctx, zip, child, rels, xmlPath, toBox, skipText, {
        off: xfrm,
        chOff: ch.off,
        chExt: ch.ext,
      });
      continue;
    }
    if (tag === "pic") {
      await paintPicture(ctx, zip, child, rels, xmlPath, toBox, group);
      continue;
    }
    if (tag === "sp" || tag === "cxnSp") {
      const placeholder = child.getElementsByTagName("p:ph").length > 0;
      if (skipText && placeholder) continue;
      await paintShape(ctx, child, toBox, skipText, group);
    }
  }
}

function mapBox(box: Box, group: { off: Box; chOff: Box; chExt: Box } | null): Box {
  if (!group || !group.chExt.w || !group.chExt.h) return box;
  return {
    x: group.off.x + ((box.x - group.chOff.x) * group.off.w) / group.chExt.w,
    y: group.off.y + ((box.y - group.chOff.y) * group.off.h) / group.chExt.h,
    w: (box.w * group.off.w) / group.chExt.w,
    h: (box.h * group.off.h) / group.chExt.h,
    rot: box.rot + group.off.rot,
  };
}

async function paintPicture(
  ctx: CanvasRenderingContext2D,
  zip: JSZip,
  pic: Element,
  rels: Map<string, Rel>,
  xmlPath: string,
  toBox: (b: Box) => Box,
  group: { off: Box; chOff: Box; chExt: Box } | null,
) {
  const embed =
    pic.getElementsByTagName("a:blip")[0]?.getAttribute("r:embed") ||
    pic.getElementsByTagName("a:blip")[0]?.getAttribute("embed");
  const xfrm = readXfrm(pic);
  if (!embed || !xfrm) return;
  const rel = rels.get(embed);
  if (!rel) return;
  const mediaPath = resolveRel(xmlPath, rel.target);
  const file = zip.file(mediaPath);
  if (!file) return;
  if (/\.(emf|wmf)$/i.test(mediaPath)) return;
  const bytes = await file.async("uint8array");
  const mime = mediaPath.toLowerCase().endsWith(".png")
    ? "image/png"
    : mediaPath.toLowerCase().endsWith(".jpg") || mediaPath.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(
    new Blob([copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength)], { type: mime }),
  );
  try {
    const img = await loadImage(url);
    const box = toBox(mapBox(xfrm, group));
    ctx.save();
    rotate(ctx, box);
    ctx.drawImage(img, box.x, box.y, box.w, box.h);
    ctx.restore();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function paintShape(
  ctx: CanvasRenderingContext2D,
  sp: Element,
  toBox: (b: Box) => Box,
  skipText: boolean,
  group: { off: Box; chOff: Box; chExt: Box } | null,
) {
  const xfrm = readXfrm(sp);
  if (!xfrm) return;
  const box = toBox(mapBox(xfrm, group));
  const prst = sp.getElementsByTagName("a:prstGeom")[0]?.getAttribute("prst") ?? "rect";
  const spPr = sp.getElementsByTagName("p:spPr")[0] || sp.getElementsByTagName("a:spPr")[0];
  const hasNoFill = Boolean(spPr?.getElementsByTagName("a:noFill").length);
  const fill = hasNoFill ? null : parseSolidColor(spPr?.outerHTML ?? "");
  const line = sp.getElementsByTagName("a:ln")[0];
  const stroke = line && !line.getElementsByTagName("a:noFill").length ? parseSolidColor(line.outerHTML) : null;

  ctx.save();
  rotate(ctx, box);
  if (fill) {
    ctx.fillStyle = fill;
    drawPreset(ctx, prst, box);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    drawPreset(ctx, prst, box);
    ctx.stroke();
  }
  if (!skipText) paintText(ctx, sp, box);
  ctx.restore();
}

function drawPreset(ctx: CanvasRenderingContext2D, prst: string, box: Box) {
  ctx.beginPath();
  if (prst === "ellipse" || prst === "round") {
    ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
    return;
  }
  if (prst.toLowerCase().includes("arrow")) {
    const y = box.y + box.h / 2;
    ctx.moveTo(box.x, box.y + box.h * 0.28);
    ctx.lineTo(box.x + box.w * 0.62, box.y + box.h * 0.28);
    ctx.lineTo(box.x + box.w * 0.62, box.y);
    ctx.lineTo(box.x + box.w, y);
    ctx.lineTo(box.x + box.w * 0.62, box.y + box.h);
    ctx.lineTo(box.x + box.w * 0.62, box.y + box.h * 0.72);
    ctx.lineTo(box.x, box.y + box.h * 0.72);
    ctx.closePath();
    return;
  }
  if (prst === "roundRect") {
    const r = Math.min(box.w, box.h) * 0.08;
    ctx.roundRect(box.x, box.y, box.w, box.h, r);
    return;
  }
  ctx.rect(box.x, box.y, box.w, box.h);
}

function paintText(ctx: CanvasRenderingContext2D, sp: Element, box: Box) {
  const body = sp.getElementsByTagName("p:txBody")[0] || sp.getElementsByTagName("a:txBody")[0];
  if (!body) return;
  const paras = Array.from(body.getElementsByTagName("a:p"));
  let y = box.y + 8;
  for (const p of paras) {
    const runs = Array.from(p.getElementsByTagName("a:r"));
    const text = (runs.length ? runs : [p])
      .map((r) => (r.getElementsByTagName("a:t")[0]?.textContent ?? ""))
      .join("");
    if (!text.trim() && !p.getElementsByTagName("a:t").length) {
      y += 16;
      continue;
    }
    const rPr = (runs[0] || p).getElementsByTagName("a:rPr")[0] || p.getElementsByTagName("a:defRPr")[0];
    const sz = Number(rPr?.getAttribute("sz") || 1800) / 100;
    const bold = rPr?.getAttribute("b") === "1";
    const italic = rPr?.getAttribute("i") === "1";
    const color = parseSolidColor(rPr?.outerHTML ?? "") || "#1c1917";
    const align = p.getElementsByTagName("a:pPr")[0]?.getAttribute("algn");
    ctx.fillStyle = color;
    ctx.font = `${italic ? "italic " : ""}${bold ? "600 " : ""}${Math.max(12, sz * (PX_W / 960))}px Inter, system-ui, sans-serif`;
    ctx.textAlign = align === "ctr" ? "center" : align === "r" ? "right" : "left";
    ctx.textBaseline = "top";
    const maxW = Math.max(20, box.w - 16);
    const x = align === "ctr" ? box.x + box.w / 2 : align === "r" ? box.x + box.w - 8 : box.x + 8;
    const lines = wrapText(ctx, text.trim(), maxW);
    const lineH = Math.max(16, sz * (PX_W / 960) * 1.25);
    for (const line of lines) {
      if (y > box.y + box.h) break;
      ctx.fillText(line, x, y, maxW);
      y += lineH;
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function readXfrm(el: Element): Box | null {
  const xfrm = el.getElementsByTagName("a:xfrm")[0];
  if (!xfrm) return null;
  const off = xfrm.getElementsByTagName("a:off")[0];
  const ext = xfrm.getElementsByTagName("a:ext")[0];
  if (!off || !ext) return null;
  return {
    x: Number(off.getAttribute("x") || 0),
    y: Number(off.getAttribute("y") || 0),
    w: Number(ext.getAttribute("cx") || 0),
    h: Number(ext.getAttribute("cy") || 0),
    rot: Number(xfrm.getAttribute("rot") || 0) / 60000,
  };
}

function readChildXfrm(el: Element) {
  const xfrm = el.getElementsByTagName("a:xfrm")[0];
  const chOff = xfrm?.getElementsByTagName("a:chOff")[0];
  const chExt = xfrm?.getElementsByTagName("a:chExt")[0];
  return {
    off: {
      x: Number(chOff?.getAttribute("x") || 0),
      y: Number(chOff?.getAttribute("y") || 0),
      w: 0,
      h: 0,
      rot: 0,
    },
    ext: {
      x: 0,
      y: 0,
      w: Number(chExt?.getAttribute("cx") || 1),
      h: Number(chExt?.getAttribute("cy") || 1),
      rot: 0,
    },
  };
}

function rotate(ctx: CanvasRenderingContext2D, box: Box) {
  if (!box.rot) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((box.rot * Math.PI) / 180);
  ctx.translate(-cx, -cy);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? "";
}
