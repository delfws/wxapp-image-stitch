/**
 * Canvas 2D 导出：绘制拼图并保存相册
 * 与交互层共享 core/tree.js 的 computeLayout，保证所见即所得。
 */

const { computeLayout } = require("./tree");
const { EXPORT_WIDTH, MAX_CANVAS_SIDE, MAX_CANVAS_PIXELS } = require("./constants");

/**
 * 计算导出尺寸（含 iOS canvas 上限保护）
 */
function getExportSize(aspect, exportWidth) {
  let W = exportWidth || EXPORT_WIDTH;
  let H = Math.round(W / aspect);
  if (H > MAX_CANVAS_SIDE) {
    H = MAX_CANVAS_SIDE;
    W = Math.round(H * aspect);
  }
  if (W * H > MAX_CANVAS_PIXELS) {
    const s = Math.sqrt(MAX_CANVAS_PIXELS / (W * H));
    W = Math.floor(W * s);
    H = Math.floor(H * s);
  }
  return { W, H };
}

/**
 * aspectFill 裁剪绘制（与编辑层 cell-pan-img 行为一致）：
 * 等比缩放铺满 + 平移裁剪，用 9 参 drawImage 的源矩形实现
 * @param fx,fy 平移量 ∈ [-1,1]，0=居中；+1 表示图片向右/下拖（显示左/上部分）
 */
function drawAspectFill(ctx, img, cx, cy, cw, ch, iw, ih, fx, fy) {
  fx = fx || 0;
  fy = fy || 0;
  const scale = Math.max(cw / iw, ch / ih);
  const sw = cw / scale;
  const sh = ch / scale;
  // 居中源起点 + 平移：sx = (iw-sw)/2 * (1 - fx)
  const sx = ((iw - sw) / 2) * (1 - fx);
  const sy = ((ih - sh) / 2) * (1 - fy);
  ctx.drawImage(img, sx, sy, sw, sh, cx, cy, cw, ch);
}

/**
 * 简单拼接导出尺寸：按内容比例与图片实际分辨率计算（含上限保护）
 * 公共边基准 = 各原图公共边（横排取高度/竖排取宽度）的最大值，保证每张图 1:1 渲染；
 * 图片很小时下限为默认导出宽度；超过 iOS 上限时整体等比降尺度。
 *
 * 间距比例参考基准 canvasRefW = 编辑页未缩放的自然画布宽：
 *   横排：gapE = gap×W/natW，W = H×Σr + (n-1)×gapE → W = H×Σr/(1-(n-1)×gap/natW)
 *   竖排：gapE = gap×W/natW，H = W×Σ(1/r) + (n-1)×gapE → H = W×(Σ(1/r)+(n-1)×gap/natW)
 */
function getStitchExportSize(state) {
  const { images, assignments, gap, stitchDir, canvasRefW } = state;
  const n = assignments.length;
  const isRow = stitchDir !== "col";
  const ratioOf = i => {
    const im = images[assignments[i]] || { width: 1, height: 1 };
    const r = (im.width || 1) / (im.height || 1);
    return isRow ? r : 1 / r;
  };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += ratioOf(i);

  // 公共边基准：取各原图公共边（横排看高度、竖排看宽度）的最小值 → 任何一张图都不放大；
  // 图片很小时下限为默认导出宽度
  let minSide = Infinity;
  for (let i = 0; i < n; i++) {
    const im = images[assignments[i]] || { width: 1, height: 1 };
    minSide = Math.min(minSide, isRow ? im.height || 1 : im.width || 1);
  }
  const BASE = Math.max(Math.min(minSide, MAX_CANVAS_SIDE), EXPORT_WIDTH);

  const natW = canvasRefW || 2000;
  const gk = ((gap || 0) * (n - 1)) / natW; // (n-1) 条间距占参考宽的比例
  let W, H;
  if (isRow) {
    const denom = Math.max(1 - gk, 0.1);
    H = BASE;
    W = (H * sum) / denom;
    if (W > MAX_CANVAS_SIDE) {
      W = MAX_CANVAS_SIDE;
      H = (W * denom) / sum;
    }
  } else {
    const k = sum + gk;
    W = BASE;
    H = W * k;
    if (H > MAX_CANVAS_SIDE) {
      H = MAX_CANVAS_SIDE;
      W = H / k;
    }
  }
  if (W * H > MAX_CANVAS_PIXELS) {
    const s = Math.sqrt(MAX_CANVAS_PIXELS / (W * H));
    W *= s;
    H *= s;
  }
  // 先取整短边（公共边），再按布局公式回算长边，保证 Σ格 + 间距 = 长边 精确自洽
  if (isRow) {
    H = Math.floor(H);
    W = Math.min(Math.round((H * sum) / Math.max(1 - gk, 0.1)), MAX_CANVAS_SIDE);
  } else {
    W = Math.floor(W);
    H = Math.min(Math.round(W * (sum + gk)), MAX_CANVAS_SIDE);
  }
  return { W, H };
}

/**
 * 模板拼接导出尺寸：按图片实际分辨率推导，保证每格缩放 ≤ 1（最多缩小、绝不放大，不损失清晰度），
 * 在此前提下取最高清晰度，再受 iOS canvas 上限保护。
 * 做法：按参考宽 1000 算出每格占比，逐格反推"画布多大时该格恰好 1:1"，
 * 取所有格的最小值（任何一格都不放大）；下限为默认导出宽度（图片很小时避免导出过小）。
 */
function getTemplateExportSize(state) {
  const { tree, images, assignments, aspect, gap, canvasRefW } = state;
  const REF = 1000;
  const refW = canvasRefW || REF;
  const REF_H = REF / aspect;
  const gapRef = (gap || 0) * (REF / refW);
  let needW = Infinity;
  try {
    const { leafFrames } = computeLayout(tree, gapRef, REF, REF_H);
    leafFrames.forEach((f, i) => {
      const im = images[assignments[i]] || { width: 1, height: 1 };
      if (f.width > 0) needW = Math.min(needW, (im.width || 1) * (REF / f.width));
      if (f.height > 0) needW = Math.min(needW, (im.height || 1) * (REF_H / f.height));
    });
  } catch (e) {
    needW = Infinity; // 布局异常时退回默认宽度
  }
  let W = Math.max(needW, EXPORT_WIDTH);
  // H = W/aspect：单边限制 → W ≤ MAX_CANVAS_SIDE×aspect；总面积限制 → W ≤ √(MAX_PIXELS×aspect)
  const capSide = MAX_CANVAS_SIDE * aspect;
  const capArea = Math.sqrt(MAX_CANVAS_PIXELS * aspect);
  W = Math.floor(Math.min(W, capSide, capArea));
  const H = Math.round(W / aspect);
  return { W, H };
}

/**
 * 按状态取导出尺寸（模板拼接 / 简单拼接自动分支）
 */
function getExportSizeForState(state) {
  if (state.style === "stitch") return getStitchExportSize(state);
  return getTemplateExportSize(state);
}

/**
 * 渲染拼图到 2d canvas（设置缓冲区尺寸、底色、逐格绘制）
 * 注意：先设置 canvas.width/height（重置缓冲区），再取 context 绘制
 * @returns {Promise<{W:number,H:number}>}
 */
async function renderCollage(canvas, state, exportWidth) {
  if (state.style === "stitch") return renderStitchCollage(canvas, state);
  const { tree, images, assignments, gapColor, aspect } = state;
  // exportWidth 显式指定时走固定宽度；否则按图片实际分辨率推导最高清晰度
  const { W, H } = exportWidth
    ? getExportSize(aspect, exportWidth)
    : getTemplateExportSize(state);

  // 间距按导出比例放大：编辑页 gap 是相对编辑画布宽度（canvasRefW）的 CSS 像素，
  // 导出画布宽 W，需等比缩放才能与编辑页视觉一致
  const refW = state.canvasRefW || W;
  const gap = (state.gap || 0) * (W / refW);

  // 设置物理像素缓冲区（css 尺寸与缓冲区解耦，绘制坐标均为缓冲区坐标）
  canvas.width = W;
  canvas.height = H;

  // 缓冲区确定后再获取 context，避免尺寸重置导致绑定错乱
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // 同一布局函数（与预览共享）得到导出坐标系下的 frames
  const { leafFrames } = computeLayout(tree, gap, W, H);

  // 间距底色（即画布背景）
  ctx.fillStyle = gapColor;
  ctx.fillRect(0, 0, W, H);

  // 并行加载全部原图（2d canvas 专用 createImage）
  const imgs = await loadAllImages(canvas, images);

  // 逐格绘制（叶子序与 assignments 对齐）；
  // 裁剪比例用加载后的位图实际尺寸（与 drawImage 的源一致，避免 chooseMedia 尺寸误差）；
  // 平移量 fx/fy 随图片走（存于 images[imgIdx]）
  leafFrames.forEach((f, leafIndex) => {
    const imgIdx = assignments[leafIndex];
    const el = imgs[imgIdx];
    const im = images[imgIdx];
    const iw = el.width || im.width || 1;
    const ih = el.height || im.height || 1;
    drawAspectFill(ctx, el, f.left, f.top, f.width, f.height, iw, ih, im.fx, im.fy);
  });

  return { W, H };
}

/**
 * 简单拼接渲染：横排等高 / 竖排等宽，图片完整显示不裁剪
 * 导出尺寸由内容比例决定（getStitchExportSize），间距按编辑画布比例缩放
 */
async function renderStitchCollage(canvas, state) {
  const { images, assignments, gapColor, stitchDir } = state;
  const { W, H } = getStitchExportSize(state);
  const isRow = stitchDir !== "col";

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // 间距：编辑页 gap 相对参考宽（canvasRefW，stitch 为自然画布宽）的 CSS 像素，等比放大到导出尺寸
  const refW = state.canvasRefW || W;
  const gap = (state.gap || 0) * (W / refW);

  ctx.fillStyle = gapColor;
  ctx.fillRect(0, 0, W, H);

  const imgs = await loadAllImages(canvas, images);

  // 累计布局：每格尺寸 = 公共边 × 原图比例（完整显示），间距逐个排布
  let pos = 0;
  assignments.forEach((imgIdx, i) => {
    const el = imgs[imgIdx];
    const im = images[imgIdx];
    const iw = el.width || im.width || 1;
    const ih = el.height || im.height || 1;
    let f;
    if (isRow) {
      f = { left: pos, top: 0, width: (H * iw) / ih, height: H };
    } else {
      f = { left: 0, top: pos, width: W, height: (W * ih) / iw };
    }
    // fx/fy 恒为 0：完整显示无裁剪平移
    drawAspectFill(ctx, el, f.left, f.top, f.width, f.height, iw, ih, 0, 0);
    pos += (isRow ? f.width : f.height) + gap;
  });

  return { W, H };
}

/** 并行加载全部原图（2d canvas 专用 createImage） */
function loadAllImages(canvas, images) {
  return Promise.all(
    images.map(
      im =>
        new Promise((resolve, reject) => {
          const c = canvas.createImage();
          c.onload = () => resolve(c);
          c.onerror = () => reject(new Error("图片加载失败: " + im.path));
          c.src = im.path;
        })
    )
  );
}

/**
 * canvas → 临时文件（2d 模式必须传 canvas 实例）
 * 不传 x/y/width/height，默认导出整个缓冲区；dest 为目标输出分辨率
 */
function canvasToTempFile(canvas, W, H) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      destWidth: W,
      destHeight: H,
      fileType: "jpg",
      quality: 0.95, // 高质量导出，减少二次压缩损失
      success: res => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

/**
 * 保存到相册（含权限被拒后的 openSetting 引导流）
 */
async function saveToAlbum(filePath) {
  try {
    await wx.saveImageToPhotosAlbum({ filePath });
    wx.showToast({ title: "已保存到相册", icon: "success" });
    return true;
  } catch (e) {
    const s = await wx.getSetting();
    if (s.authSetting["scope.writePhotosAlbum"] === false) {
      const { confirm } = await wx.showModal({
        title: "需要相册权限",
        content: "保存拼图需要「保存到相册」权限，请在设置中开启",
        confirmText: "去设置"
      });
      if (confirm) {
        const r = await wx.openSetting();
        if (r.authSetting["scope.writePhotosAlbum"]) {
          return saveToAlbum(filePath); // 授权后重试一次
        }
      }
      return false;
    }
    wx.showToast({ title: "保存失败，可长按图片手动保存", icon: "none" });
    return false;
  }
}

module.exports = {
  getExportSize,
  getExportSizeForState,
  drawAspectFill,
  renderCollage,
  canvasToTempFile,
  saveToAlbum
};
