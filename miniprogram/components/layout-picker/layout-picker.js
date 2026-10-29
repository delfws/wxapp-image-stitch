const { computeLayout, instantiateTree } = require("../../core/tree");

// 缩略图统一方框尺寸（px）：所有缩略图画布宽高一致，
// 布局预览按模板外框比例适配后在方框内居中
const THUMB_BOX = 72;
const THUMB_GAP = 3;

Component({
  properties: {
    // 当前数量可选的模板列表 [{count, name, aspect, tree}]
    layouts: {
      type: Array,
      value: []
    },
    // 当前选中模板下标
    current: {
      type: Number,
      value: 0
    }
  },

  data: {
    thumbs: [] // [{ name, w, h, cells: [{left,top,width,height}] }]
  },

  observers: {
    layouts() {
      this.buildThumbs();
    }
  },

  lifetimes: {
    attached() {
      this.buildThumbs();
    }
  },

  methods: {
    buildThumbs() {
      const layouts = this.data.layouts || [];
      const thumbs = layouts.map(tpl => {
        // 格子直接铺满统一方框（缩略图只表达布局结构，不表达外框比例）
        const tree = instantiateTree(tpl.tree);
        const out = computeLayout(tree, THUMB_GAP, THUMB_BOX, THUMB_BOX);
        return {
          name: tpl.name,
          w: THUMB_BOX,
          h: THUMB_BOX,
          cells: out.leafFrames.map(f => ({
            left: Math.round(f.left),
            top: Math.round(f.top),
            width: Math.round(f.width),
            height: Math.round(f.height)
          }))
        };
      });
      this.setData({ thumbs });
    },

    onTap(e) {
      const index = e.currentTarget.dataset.index;
      this.triggerEvent("select", { index });
    }
  }
});
