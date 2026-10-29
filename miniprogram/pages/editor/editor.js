const { instantiateTree, computeLayout, findNode, setDividerRatios } = require("../../core/tree");
const LAYOUTS = require("../../core/layouts");
const C = require("../../core/constants");

Page({
  data: {
    images: [], // [{ path, width, height }]
    tree: null, // 运行时分割树（模板拼接用）
    assignments: [], // assignments[leafIndex] = images 下标
    style: "template", // template=模板拼接（分割树），stitch=简单拼接（横/竖排）
    stitchDir: "row", // stitch 模式方向：row=横排（等高），col=竖排（等宽）
    gap: 6,
    gapColor: "#FFFFFF",
    aspect: 1,
    aspectKey: "1:1",
    aspects: C.ASPECTS,
    gapColors: C.GAP_COLORS,
    canvasW: 0,
    canvasH: 0,
    cells: [], // 渲染数组 [{leafIndex, path, left, top, width, height}]
    dividers: [], // 渲染数组 [{key, nodeId, index, horizontal, hit*, line*, innerLen}]
    dividerActive: "", // 正在拖动的分割线 key（仅该条显示视觉线）
    layouts: [], // 当前数量可选模板
    currentLayout: 0,
    activeTab: 0, // 0布局 1间距 2图片
    editMode: "pan", // pan=拖动调整位置，swap=拖动互换
    drag: null, // 图片拖拽浮层 {src, path, x, y, w, h, hit, fading}
    maxCount: 9,
    capsuleTop: 20, // 系统胶囊 top（px）
    capsuleHeight: 32, // 系统胶囊 height（px）
    headerPad: 10 // 固定导航下内边距（px），与 .editor-header padding-bottom 保持一致
  },

  onLoad() {
    let capsuleTop = 20;
    let capsuleHeight = 32;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const rect = wx.getMenuButtonBoundingClientRect();
      if (rect && rect.height) {
        capsuleTop = rect.top;
        capsuleHeight = rect.height;
      } else {
        capsuleTop = (info.statusBarHeight || 20) + 6;
      }
    } catch (e) {
      /* 忽略 */
    }
    try {
      this._winH = wx.getWindowInfo().windowHeight || 667;
    } catch (e) {
      this._winH = 667;
    }
    this.setData({ capsuleTop, capsuleHeight });
    // 进入即选图
    this.pickImages(true);
  },

  goBack() {
    wx.navigateBack();
  },

  onUnload() {
    this._dividerDrag = null;
    this._cellDrag = null;
    this._touch = null;
  },

  // ============ 选图 / 初始化 ============

  /** 通过 wx.getImageInfo 取真实尺寸（chooseMedia 的 width/height 在部分机型不准/缺失） */
  loadImagesWithInfo(files) {
    return Promise.all(
      files.map(
        f =>
          new Promise(resolve => {
            wx.getImageInfo({
              src: f.tempFilePath,
              success: r =>
                resolve({
                  path: f.tempFilePath,
                  width: r.width || f.width || 1000,
                  height: r.height || f.height || 1000
                }),
              fail: () =>
                resolve({
                  path: f.tempFilePath,
                  width: f.width || 1000,
                  height: f.height || 1000
                })
            });
          })
      )
    );
  },

  pickImages(fresh) {
    wx.chooseMedia({
      count: 9,
      mediaTypes: ["image"],
      sizeType: ["original"],
      success: res => {
        if (!res.tempFiles || !res.tempFiles.length) return;
        wx.showLoading({ title: "加载图片…", mask: true });
        this.loadImagesWithInfo(res.tempFiles).then(images => {
          wx.hideLoading();
          this.setupImages(images, fresh);
        });
      },
      fail: () => {
        if (fresh && this.data.images.length === 0) {
          // 用户取消，留在空态
        }
      }
    });
  },

  /** 用一组图片初始化/重置编辑器（fresh=true 时采用模板默认外框比例） */
  setupImages(images, fresh) {
    const count = images.length;
    if (count < 2) {
      wx.showToast({ title: "至少需要 2 张图片", icon: "none" });
      return;
    }
    const templates = LAYOUTS.filter(l => l.count === count);
    const aspect = fresh ? templates[0].aspect : this.data.aspect;
    let idx = templates.findIndex(t => Math.abs(t.aspect - aspect) < 0.001);
    if (idx < 0) idx = 0;
    // 非 fresh 时保留用户已选的外框比例
    const useAspect = fresh ? templates[idx].aspect : this.data.aspect;
    this.setData({
      images,
      layouts: templates,
      currentLayout: idx,
      tree: instantiateTree(templates[idx].tree),
      assignments: images.map((_, i) => i),
      aspect: useAspect,
      aspectKey: this.keyForAspect(useAspect),
      drag: null
    }, () => {
      this.refreshCanvas();
    });
  },

  keyForAspect(value) {
    const hit = C.ASPECTS.find(a => Math.abs(a.value - value) < 0.001);
    return hit ? hit.key : "1:1";
  },

  // ============ 画布尺寸与渲染 ============

  /**
   * 画布尺寸与渲染：页面为自然文档流（整页可滚动），
   * 画布宽度撑满可用宽度、高度随比例自然伸展；简单拼接以窗口高度做宽松上限
   */
  refreshCanvas() {
    this.createSelectorQuery()
      .select(".canvas-area")
      .boundingClientRect(rect => {
        if (!rect || !rect.width) return;
        let w, h;
        if (this.data.style === "stitch") {
          // 简单拼接：画布尺寸由图片内容和方向决定（宽度撑满，高度上限放宽到整窗）
          this._areaSize = { w: rect.width, h: this._winH };
          const s = this.stitchSize();
          w = s.cw;
          h = s.ch;
        } else {
          // 模板拼接：宽度撑满，高度按外框比例，超高时整页滚动查看
          w = rect.width - 8;
          h = w / this.data.aspect;
          this._areaSize = { w: rect.width, h };
        }
        this.setData(
          { canvasW: Math.floor(w), canvasH: Math.floor(h) },
          () => {
            this.updateRender();
            this.cacheCanvasRect();
          }
        );
      })
      .exec();
  },

  // ============ 简单拼接（横排等高 / 竖排等宽） ============

  /**
   * 计算简单拼接的显示画布尺寸
   * 横排：公共高基准 220px，各图宽 = 220 × 宽高比，总宽含间距，超可用宽度则等比缩小
   * 竖排：公共宽基准 240px，各图高 = 240 × 高宽比，总高含间距，超可用高度则等比缩小
   */
  stitchSize() {
    const { images, assignments, gap, stitchDir } = this.data;
    const area = this._areaSize || { w: 360, h: 480 };
    const maxW = area.w - 8;
    const maxH = area.h - 8;
    const n = assignments.length || images.length;
    const ratioOf = i => {
      const im = images[assignments[i]] || images[i] || { width: 1, height: 1 };
      const r = (im.width || 1) / (im.height || 1);
      return stitchDir === "row" ? r : 1 / r;
    };
    let sum = 0;
    for (let i = 0; i < n; i++) sum += ratioOf(i);
    const base = stitchDir === "row" ? 220 : 240;
    const totalNat = base * sum + (n - 1) * gap;
    const scale =
      stitchDir === "row"
        ? Math.min(1, maxW / totalNat)
        : Math.min(1, maxH / totalNat);
    // natW = 未缩放的自然画布宽（导出时间距比例的参考基准）
    const natW = stitchDir === "row" ? totalNat : base;
    return stitchDir === "row"
      ? { cw: totalNat * scale, ch: base * scale, scale, natW }
      : { cw: base * scale, ch: totalNat * scale, scale, natW };
  },

  /** 简单拼接渲染数组：图片完整显示不裁剪，顺序 = assignments 顺序 */
  buildStitchRender() {
    const { images, assignments, gap, stitchDir } = this.data;
    const n = assignments.length;
    const s = this.stitchSize();
    // 间距随画布等比缩放（与导出公式一致：gap × 画布缩放比）
    const g = gap * s.scale;
    const cells = [];
    let pos = 0;
    for (let i = 0; i < n; i++) {
      const imgIdx = assignments[i];
      const im = images[imgIdx] || { path: "", width: 1, height: 1 };
      const r = (im.width || 1) / (im.height || 1);
      const fw = stitchDir === "row" ? 220 * r * s.scale : s.cw;
      const fh = stitchDir === "row" ? s.ch : (240 / r) * s.scale;
      cells.push({
        leafIndex: i,
        path: im.path,
        left: stitchDir === "row" ? pos : 0,
        top: stitchDir === "row" ? 0 : pos,
        width: fw,
        height: fh,
        // 完整显示：图片尺寸 = 格子尺寸，无溢出无平移
        imgW: fw,
        imgH: fh,
        imgLeft: 0,
        imgTop: 0,
        excessW: 0,
        excessH: 0,
        imgIdx
      });
      pos += (stitchDir === "row" ? fw : fh) + g;
    }
    return { cells, dividers: [] };
  },

  /** 缓存画布容器 rect（触摸坐标换算用，记录缓存时的滚动位置以便校正） */
  cacheCanvasRect() {
    this.createSelectorQuery()
      .select(".canvas-box")
      .boundingClientRect(rect => {
        if (rect) {
          this._canvasRect = rect;
          this._canvasRectScrollTop = this._curScrollTop || 0;
        }
      })
      .exec();
  },

  /** 整页滚动会改变元素视口坐标，按滚动差量校正画布 rect */
  getCanvasRect() {
    const r = this._canvasRect;
    if (!r) return null;
    const dy = (this._curScrollTop || 0) - (this._canvasRectScrollTop || 0);
    return { left: r.left, top: r.top - dy, width: r.width, height: r.height };
  },

  /** 跟踪整页滚动位置（交换命中检测的坐标校正用） */
  onPageScroll(e) {
    this._curScrollTop = e.scrollTop || 0;
  },

  /** 重算 cells / dividers 渲染数组 */
  updateRender() {
    if (!this.data.canvasW) return;
    const { cells, dividers } = this.buildRender();
    this.setData({ cells, dividers });
  },

  buildRender() {
    if (this.data.style === "stitch") return this.buildStitchRender();
    const { tree, gap, canvasW, canvasH, images, assignments } = this.data;
    const out = computeLayout(tree, gap, canvasW, canvasH);
    const HIT_HALF = C.DIVIDER_HIT_SIZE / 2;
    const LINE_HALF = C.DIVIDER_LINE_WIDTH / 2;

    const cells = out.leafFrames.map((f, i) => {
      const imgIdx = assignments[i];
      const im = images[imgIdx] || { path: "", width: 1, height: 1 };
      const iw = im.width || 1;
      const ih = im.height || 1;
      // 等比铺满（与 aspectFill 一致）：取较大缩放比
      const s = Math.max(f.width / iw, f.height / ih);
      const dw = s * iw; // 图片在格子内的显示尺寸
      const dh = s * ih;
      const excessW = dw - f.width; // 横向溢出（可平移范围）
      const excessH = dh - f.height;
      // 平移量 fx/fy ∈ [-1,1]，存于图片对象，随图片走
      const fx = im.fx || 0;
      const fy = im.fy || 0;
      return {
        leafIndex: i,
        path: im.path,
        left: f.left,
        top: f.top,
        width: f.width,
        height: f.height,
        // 内层图片绝对定位：居中后按 fx/fy 平移
        imgW: dw,
        imgH: dh,
        imgLeft: -excessW / 2 + (fx * excessW) / 2,
        imgTop: -excessH / 2 + (fy * excessH) / 2,
        excessW,
        excessH,
        imgIdx
      };
    });

    const dividers = out.dividers.map(d => {
      const item = {
        key: d.nodeId + "-" + d.index,
        nodeId: d.nodeId,
        index: d.index,
        horizontal: d.horizontal
      };
      if (d.horizontal) {
        // 垂直线，拖动沿 X 轴
        const cx = d.frame.left + d.frame.width / 2;
        item.hitLeft = cx - HIT_HALF;
        item.hitTop = d.frame.top;
        item.hitW = C.DIVIDER_HIT_SIZE;
        item.hitH = d.frame.height;
        item.lineLeft = cx - LINE_HALF;
        item.lineTop = d.frame.top;
        item.lineW = C.DIVIDER_LINE_WIDTH;
        item.lineH = d.frame.height;
        item.innerLen = d.parentFrame.width - gap * (d.childCount - 1);
      } else {
        // 水平线，拖动沿 Y 轴
        const cy = d.frame.top + d.frame.height / 2;
        item.hitLeft = d.frame.left;
        item.hitTop = cy - HIT_HALF;
        item.hitW = d.frame.width;
        item.hitH = C.DIVIDER_HIT_SIZE;
        item.lineLeft = d.frame.left;
        item.lineTop = cy - LINE_HALF;
        item.lineW = d.frame.width;
        item.lineH = C.DIVIDER_LINE_WIDTH;
        item.innerLen = d.parentFrame.height - gap * (d.childCount - 1);
      }
      return item;
    });

    return { cells, dividers };
  },

  // ============ 分割线拖拽 ============

  onDividerStart(e) {
    const { nodeid, dindex } = e.currentTarget.dataset;
    const node = findNode(this.data.tree, nodeid);
    if (!node) return;
    const render = this.data.dividers.find(d => d.nodeId === nodeid && d.index === dindex);
    if (!render) return;
    this._dividerDrag = {
      nodeId: nodeid,
      index: dindex,
      horizontal: !!render.horizontal,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      base: [node.ratios[dindex], node.ratios[dindex + 1]],
      innerLen: render.innerLen
    };
    // 显示被拖动的这条分割线
    this.setData({ dividerActive: nodeid + "-" + dindex });
  },

  onDividerMove(e) {
    const drag = this._dividerDrag;
    if (!drag || !drag.innerLen) return;
    const cur = drag.horizontal ? e.touches[0].clientX : e.touches[0].clientY;
    const start = drag.horizontal ? drag.startX : drag.startY;
    const delta = (cur - start) / drag.innerLen;
    if (setDividerRatios(this.data.tree, drag.nodeId, drag.index, drag.base, delta)) {
      this.updateRender();
    }
  },

  onDividerEnd() {
    this._dividerDrag = null;
    this.setData({ dividerActive: "" });
  },

  // ============ 图片手势：按当前模式分流（平移 / 交换），单击替换 ============

  /** 切换编辑模式：pan=拖动调整显示位置，swap=拖动到另一格互换 */
  onModeTap(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.editMode) return;
    this.setData({ editMode: mode });
  },

  onCellTouchStart(e) {
    const leafIndex = e.currentTarget.dataset.leafindex;
    const cell = this.data.cells[leafIndex];
    if (!cell) return;
    const imgIdx = cell.imgIdx;
    const im = this.data.images[imgIdx] || {};
    // 统一记录触摸起点，模式决定后续 move/end 的语义
    // 简单拼接：图片完整显示无平移空间，固定为拖动交换位置
    this._touch = {
      mode: this.data.style === "stitch" ? "swap" : this.data.editMode,
      leafIndex,
      imgIdx,
      cell,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      fx0: im.fx || 0,
      fy0: im.fy || 0,
      excessW: cell.excessW,
      excessH: cell.excessH,
      active: false
    };
  },

  onCellTouchMove(e) {
    const t = this._touch;
    if (!t) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    // 阈值判定：超过才激活，避免误触（tap 替换仍可用）
    if (!t.active) {
      if (Math.abs(x - t.startX) < 6 && Math.abs(y - t.startY) < 6) return;
      t.active = true;
      try {
        wx.vibrateShort({ type: "light" });
      } catch (err) {
        /* 忽略震动失败 */
      }
      // 进入交换模式：立即显示拖拽浮层（内层图带平移量，与源格显示一致）
      if (t.mode === "swap") {
        this._cellDrag = { src: t.leafIndex, active: true };
        this.setData({
          drag: {
            src: t.leafIndex,
            path: t.cell.path,
            x,
            y,
            w: t.cell.width,
            h: t.cell.height,
            imgW: t.cell.imgW,
            imgH: t.cell.imgH,
            imgLeft: t.cell.imgLeft,
            imgTop: t.cell.imgTop,
            hit: t.leafIndex,
            fading: false
          }
        });
      }
    }

    if (t.mode === "swap") {
      const rect = this.getCanvasRect();
      if (!rect) return;
      const lx = x - rect.left;
      const ly = y - rect.top;
      let hit = null;
      const frames = this.data.cells;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (lx >= f.left && lx <= f.left + f.width && ly >= f.top && ly <= f.top + f.height) {
          hit = i;
          break;
        }
      }
      this.setData({ "drag.x": x, "drag.y": y, "drag.hit": hit });
    } else {
      // 平移：位移换算成 fx/fy
      let fx = t.fx0;
      let fy = t.fy0;
      if (t.excessW > 1) {
        fx = this._clamp(t.fx0 + (x - t.startX) / (t.excessW / 2), -1, 1);
      }
      if (t.excessH > 1) {
        fy = this._clamp(t.fy0 + (y - t.startY) / (t.excessH / 2), -1, 1);
      }
      this.setPan(t.imgIdx, fx, fy);
    }
  },

  onCellTouchEnd() {
    const t = this._touch;
    if (!t) return;
    if (t.active && t.mode === "swap") {
      const drag = this.data.drag;
      const hit = drag ? drag.hit : null;
      if (hit !== null && hit !== t.leafIndex) {
        const assignments = this.data.assignments.slice();
        const tmp = assignments[t.leafIndex];
        assignments[t.leafIndex] = assignments[hit];
        assignments[hit] = tmp;
        this.setData({ assignments });
        this.updateRender();
      }
      this.setData({ "drag.fading": true });
      setTimeout(() => {
        this.setData({ drag: null });
      }, 180);
    }
    // 平移模式：位置已实时更新，无需收尾
    this._touch = null;
    this._cellDrag = null;
  },

  /** 写入图片平移量并刷新渲染 */
  setPan(imgIdx, fx, fy) {
    const images = this.data.images;
    if (!images[imgIdx]) return;
    images[imgIdx].fx = fx;
    images[imgIdx].fy = fy;
    this.updateRender();
  },

  _clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  },

  /** 单击格子 → 替换单图（新图平移量归零） */
  onCellTap(e) {
    const leafIndex = e.currentTarget.dataset.leafindex;
            wx.chooseMedia({
              count: 1,
              mediaTypes: ["image"],
              sizeType: ["original"],
      sizeType: ["original"],
      success: res => {
        if (!res.tempFiles || !res.tempFiles.length) return;
        this.loadImagesWithInfo(res.tempFiles).then(([img]) => {
          const images = this.data.images.slice();
          images[this.data.assignments[leafIndex]] = {
            path: img.path,
            width: img.width,
            height: img.height,
            fx: 0,
            fy: 0
          };
          this.setData({ images });
          this.updateRender();
        });
      }
    });
  },

  // ============ 工具栏：布局 / 间距 / 图片 ============

  onTabTap(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    if (tab === this.data.activeTab) return;
    // 工具栏面板高度随 Tab 变化，渲染完成后重新适配画布区
    this.setData({ activeTab: tab }, () => this.refreshCanvas());
  },

  onLayoutSelect(e) {
    const index = e.detail.index;
    const tpl = this.data.layouts[index];
    if (!tpl) return;
    this.setData({
      currentLayout: index,
      tree: instantiateTree(tpl.tree)
    });
    this.updateRender();
  },

  onGapChanging(e) {
    this.setData({ gap: e.detail.value });
    this.updateRender();
  },

  onGapColorChange(e) {
    this.setData({ gapColor: e.detail.value });
  },

  onAspectTap(e) {
    const key = e.currentTarget.dataset.key;
    const item = C.ASPECTS.find(a => a.key === key);
    if (!item || item.key === this.data.aspectKey) return;
    this.setData({ aspect: item.value, aspectKey: item.key });
    this.refreshCanvas();
  },

  /** 切换拼接方式：模板拼接 / 简单拼接 */
  onStyleTap(e) {
    const style = e.currentTarget.dataset.style;
    if (!style || style === this.data.style) return;
    this.setData({ style, drag: null }, () => this.refreshCanvas());
  },

  /** 简单拼接方向：横排（等高）/ 竖排（等宽） */
  onDirTap(e) {
    const dir = e.currentTarget.dataset.dir;
    if (!dir || dir === this.data.stitchDir) return;
    this.setData({ stitchDir: dir }, () => this.refreshCanvas());
  },

  /** 追加图片（数量变化需重选布局） */
  onAddImages() {
    const remain = 9 - this.data.images.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaTypes: ["image"],
      sizeType: ["original"],
      success: res => {
        if (!res.tempFiles || !res.tempFiles.length) return;
        wx.showLoading({ title: "加载图片…", mask: true });
        this.loadImagesWithInfo(res.tempFiles).then(newImages => {
          wx.hideLoading();
          this.setupImages(this.data.images.concat(newImages), false);
        });
      }
    });
  },

  onImageThumbTap(e) {
    const index = e.currentTarget.dataset.index;
    wx.showActionSheet({
      itemList: ["替换此图"],
      success: res => {
        if (res.tapIndex !== 0) return;
        wx.chooseMedia({
          count: 1,
          mediaTypes: ["image"],
          success: r => {
            if (!r.tempFiles || !r.tempFiles.length) return;
            this.loadImagesWithInfo(r.tempFiles).then(([img]) => {
              const images = this.data.images.slice();
              images[index] = { path: img.path, width: img.width, height: img.height };
              this.setData({ images });
              this.updateRender();
            });
          }
        });
      }
    });
  },

  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.images.length <= 2) {
      wx.showToast({ title: "至少保留 2 张图片", icon: "none" });
      return;
    }
    wx.showModal({
      title: "删除图片",
      content: "删除后布局将按剩余图片数量重新选择",
      success: res => {
        if (!res.confirm) return;
        const images = this.data.images.slice();
        images.splice(index, 1);
        this.setupImages(images, false);
      }
    });
  },

  // ============ 导出 ============

  onExport() {
    if (!this.data.tree || this.data.images.length < 2) return;
    const app = getApp();
    app.globalData.editorState = {
      tree: this.data.tree,
      images: this.data.images,
      assignments: this.data.assignments,
      style: this.data.style,
      stitchDir: this.data.stitchDir,
      gap: this.data.gap,
      gapColor: this.data.gapColor,
      aspect: this.data.aspect,
      // 间距比例参考宽度：模板=编辑画布宽；简单拼接=未缩放的自然画布宽
      canvasRefW:
        this.data.style === "stitch" && this.data.images.length
          ? Math.round(this.stitchSize().natW)
          : this.data.canvasW || 0
    };
    wx.navigateTo({ url: "/pages/preview/preview" });
  },

  onRepick() {
    this.pickImages(true);
  }
});
