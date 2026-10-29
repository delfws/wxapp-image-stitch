App({
  onLaunch() {
    // 纯前端应用：无登录、无网络请求
  },
  globalData: {
    // 编辑器状态由 editor 页持有，preview 页通过此全局对象传递（避免 URL 传大对象）
    editorState: null
  }
});
