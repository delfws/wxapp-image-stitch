const E = require("../../core/export");

Page({
  data: {
    W: 0,
    H: 0,
    resultPath: "",
    rendering: true,
    saving: false,
    capsuleTop: 20,
    capsuleHeight: 32,
    headerPad: 10, // 固定导航下内边距（px），与 .editor-header padding-bottom 保持一致
    dispW: 0,
    dispH: 0
  },

  onLoad() {
    const state = getApp().globalData.editorState;
    if (!state || !state.tree) {
      wx.navigateBack();
      return;
    }
    this._state = state;
    const size = E.getExportSizeForState(state);
    let capsuleTop = 20;
    let capsuleHeight = 32;
    try {
      const rect = wx.getMenuButtonBoundingClientRect();
      if (rect && rect.height) {
        capsuleTop = rect.top;
        capsuleHeight = rect.height;
      } else {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        capsuleTop = (info.statusBarHeight || 20) + 6;
      }
    } catch (e) {
      /* 忽略 */
    }
    this.setData({ W: size.W, H: size.H, capsuleTop, capsuleHeight });
  },

  onReady() {
    // canvas 节点需在页面 ready 后获取
    this.render();
  },

  render() {
    this.createSelectorQuery()
      .select("#exportCanvas")
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res[0] || !res[0].node) {
          this.setData({ rendering: false });
          wx.showToast({ title: "画布初始化失败", icon: "none" });
          return;
        }
        const canvas = res[0].node;
        E.renderCollage(canvas, this._state)
          .then(({ W, H }) => E.canvasToTempFile(canvas, W, H))
          .then(path => {
            this.setData({ resultPath: path, rendering: false }, () => {
              this.fitImage();
            });
          })
          .catch(err => {
            console.error("导出渲染失败", err);
            this.setData({ rendering: false });
            wx.showToast({ title: "渲染失败，请返回重试", icon: "none" });
          });
      });
  },

  /** 按导出图实际宽高比，在舞台可用区域内计算最大等比显示尺寸（容器贴合图片，不留黑边） */
  fitImage() {
    const { W, H } = this.data;
    if (!W || !H) return;
    this.createSelectorQuery()
      .select(".preview-stage")
      .boundingClientRect(rect => {
        if (!rect || !rect.width || !rect.height) return;
        // 舞台含 30rpx 内边距，可用区域取 content box
        const availW = rect.width - 30;
        const availH = rect.height - 30;
        const scale = Math.min(availW / W, availH / H);
        this.setData({
          dispW: Math.max(Math.floor(W * scale), 1),
          dispH: Math.max(Math.floor(H * scale), 1)
        });
      })
      .exec();
  },

  onSave() {
    if (!this.data.resultPath || this.data.saving) return;
    this.setData({ saving: true });
    E.saveToAlbum(this.data.resultPath).then(() => {
      this.setData({ saving: false });
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
