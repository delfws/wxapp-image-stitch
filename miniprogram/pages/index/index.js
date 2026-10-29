Page({
  data: {
    statusBarHeight: 20,
    steps: [
      { icon: "🖼", title: "选图片", desc: "从相册挑选 2~9 张照片" },
      { icon: "🧩", title: "拼版式", desc: "布局 / 比例 / 间距自由调节" },
      { icon: "📲", title: "存相册", desc: "高清导出，一键保存分享" }
    ]
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
    } catch (e) {
      /* 忽略 */
    }
  },

  onStart() {
    wx.navigateTo({ url: "/pages/editor/editor" });
  }
});
