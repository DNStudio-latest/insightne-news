// Chooses where the text goes on a poster, from where the people or main subject are in the photo, so the headline never
// covers a face: text on the left when the subject is on the right, text on the right when the subject is on the left,
// and along the bottom when the subject is in the middle (or the headline is too long for a side panel).
// How: the picture is measured on a small grid. Detail (edges) and colour mark where the subject is (people stand out
// from a plain background); their centre is the subject's position. The area with the least in it, away from the
// subject, wins. No AI service is used.
import sharp from "sharp";

const GW = 48; // the picture is measured on a small 48 x 27 grid
const GH = 27;

// The share of the width taken by a side panel.
export const SIDE_SHARE = 0.52;

// jpeg: the photo already cropped to 16:9. Returns { layout: "bottom" | "left" | "right", focus: { x, y }, scores }.
export async function chooseLayout(jpeg, { headlineLength = 0, allowSides = true } = {}) {
  const px = await sharp(jpeg).resize(GW, GH, { fit: "fill" }).removeAlpha().raw().toBuffer(); // RGB, 3 values per cell
  const lum = (x, y) => {
    const i = (Math.min(y, GH - 1) * GW + Math.min(x, GW - 1)) * 3;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };
  // Detail in a cell: how much the brightness changes next to it. Colour: how far from grey it is.
  const energy = (x, y) => (Math.abs(lum(x + 1, y) - lum(x, y)) + Math.abs(lum(x, y + 1) - lum(x, y))) / 255;
  const colour = (x, y) => {
    const i = (y * GW + x) * 3;
    return (Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2])) / 255;
  };

  // The subject's position: the centre of the cells that stand out most (the strongest quarter, squared to favour them).
  const weights = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) weights.push({ x, y, w: energy(x, y) + 0.3 * colour(x, y) });
  const sorted = weights.map((c) => c.w).sort((a, b) => b - a);
  const floor = sorted[Math.floor(sorted.length * 0.25)] || 0;
  const cut = Math.round(GW * SIDE_SHARE);
  const bottomFrom = Math.round(GH * 0.58);
  // How much of the subject lies in each place the text could go (the share of the strong cells, 0 to 1).
  const mass = { left: 0, right: 0, bottom: 0 };
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const c of weights) {
    if (c.w < floor) continue;
    const w = c.w * c.w;
    sw += w;
    sx += w * (c.x + 0.5);
    sy += w * (c.y + 0.5);
    if (c.x < cut) mass.left += w;
    if (c.x >= GW - cut) mass.right += w;
    if (c.y >= bottomFrom) mass.bottom += w;
  }
  for (const k of Object.keys(mass)) mass[k] = sw > 0 ? mass[k] / sw : 0;
  const focus = sw > 0 ? { x: sx / sw / GW, y: sy / sw / GH } : { x: 0.5, y: 0.5 };

  const mean = (x0, x1, y0, y1) => {
    let sum = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++, n++) sum += energy(x, y);
    return n ? sum / n : 0;
  };
  const detail = { left: mean(0, cut, 0, GH), right: mean(GW - cut, GW, 0, GH), bottom: mean(0, GW, bottomFrom, GH) };
  // The bottom is the usual place; a side is preferred when the subject is clearly off to the other side and that side is calm.
  const reward = { bottom: 0.1, left: Math.max(0, focus.x - 0.5) * 1.4 - 0.1, right: Math.max(0, 0.5 - focus.x) * 1.4 - 0.1 };
  const scores = {};
  for (const k of ["bottom", "left", "right"]) scores[k] = mass[k] * 6 + detail[k] * 2 - reward[k];
  const options = allowSides && headlineLength <= 120 ? ["bottom", "left", "right"] : ["bottom"];
  const layout = options.sort((a, b) => scores[a] - scores[b])[0];
  return { layout, focus, scores, mass };
}
