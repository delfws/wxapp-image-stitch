const { computeLayout, instantiateTree } = require("../../core/tree");

// 缩略图基准尺寸（px）
const THUMB_BASE = 96;
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
        // 缩略图按模板 aspect 适配到基准框内
        const aspect = tpl.aspect || 1;
        let w = THUMB_BASE;
        let h = Math.round(THUMB_BASE / aspect);
        if (h > THUMB_BASE) {
          h = THUMB_BASE;
          w = Math.round(THUMB_BASE * aspect);
        }
        const tree = instantiateTree(tpl.tree);
        const out = computeLayout(tree, THUMB_GAP, w, h);
        return {
          name: tpl.name,
          w,
          h,
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
