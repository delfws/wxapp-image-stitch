/**
 * 分割树核心（纯函数）
 * WXML 交互层与 Canvas 导出层共享的唯一布局计算源。
 */

const { MIN_RATIO } = require("./constants");

/**
 * 深拷贝模板并注入运行时信息：
 * - 叶子注入 leafIndex（先序遍历 0..n-1）
 * - 内部节点注入 nodeId（"n0", "n1", ...）
 */
function instantiateTree(template, counter) {
  counter = counter || { n: 0, leaf: 0 };
  const node = { d: template.d, ratios: template.ratios.slice(), nodeId: "n" + counter.n++ };
  node.children = template.children.map(child => {
    if (child.leaf) {
      return { leaf: true, leafIndex: counter.leaf++ };
    }
    return instantiateTree(child, counter);
  });
  return node;
}

/** 统计叶子数 */
function countLeaves(node) {
  if (node.leaf) return 1;
  return node.children.reduce((s, c) => s + countLeaves(c), 0);
}

/** 按 nodeId 查找节点 */
function findNode(root, nodeId) {
  if (root.leaf) return null;
  if (root.nodeId === nodeId) return root;
  for (const child of root.children) {
    const hit = findNode(child, nodeId);
    if (hit) return hit;
  }
  return null;
}

/**
 * 递归布局：树 + 外框 → 每个叶子的像素 frame + 每条分割线的热区 frame
 *
 * @param {object} node   运行时树
 * @param {object} frame  当前子树可用区域 { left, top, width, height }（px）
 * @param {number} gap    间距 px
 * @param {object} out    输出 { leafFrames: [], dividers: [] }
 */
function layoutNode(node, frame, gap, out) {
  if (node.leaf) {
    out.leafFrames[node.leafIndex] = frame;
    return;
  }

  const horizontal = node.d === "row"; // row → 沿 X 分配
  const count = node.children.length;
  const total = horizontal ? frame.width : frame.height;
  const inner = total - gap * (count - 1); // 扣除间距后的可分配长度
  let offset = horizontal ? frame.left : frame.top;

  node.children.forEach((child, i) => {
    const size = inner * node.ratios[i];
    const childFrame = horizontal
      ? { left: offset, top: frame.top, width: size, height: frame.height }
      : { left: frame.left, top: offset, width: frame.width, height: size };
    layoutNode(child, childFrame, gap, out);

    // 分割线：位于第 i 个子项末尾、第 i+1 个子项开头
    // parentFrame 供交互层做"位移 → 比例"换算（沿轴总长含 gap）
    if (i < count - 1) {
      out.dividers.push({
        nodeId: node.nodeId, // 归属的内部节点
        index: i, // 该节点的第 i 条线（介于 children[i] 与 children[i+1]）
        horizontal, // true = 垂直线（拖动沿 X 轴）
        childCount: count, // 归属节点的子项数（用于计算可分配长度）
        frame: horizontal
          ? { left: offset + size, top: frame.top, width: gap, height: frame.height }
          : { left: frame.left, top: offset + size, width: frame.width, height: gap },
        parentFrame: frame
      });
    }
    offset += size + gap;
  });
}

/**
 * 入口：给定外框宽高，得到全部像素坐标（预览与导出共用，仅 scale 不同）
 * @returns {
 *   leafFrames: [{left,top,width,height}],
 *   dividers: [{nodeId,index,horizontal,frame,parentFrame}]
 * }
 */
function computeLayout(tree, gap, W, H) {
  const out = { leafFrames: [], dividers: [] };
  layoutNode(tree, { left: 0, top: 0, width: W, height: H }, gap, out);
  return out;
}

/**
 * 拖动分割线（增量式）：在当前 ratios 基础上加 delta
 */
function applyDividerDrag(tree, nodeId, index, delta) {
  const node = findNode(tree, nodeId);
  if (!node) return false;
  return setDividerRatios(tree, nodeId, index, [node.ratios[index], node.ratios[index + 1]], delta);
}

/**
 * 拖动分割线（快照式，touchmove 高频调用推荐）：
 * 以 touchstart 时的比例快照 base 为基准，设置新比例 = base + delta（带钳制）
 *
 * @param {object} tree    运行时树
 * @param {string} nodeId  分割线归属节点 id
 * @param {number} index   第 index 条线
 * @param {number[]} base  快照 [ratios[index], ratios[index+1]]
 * @param {number} delta   归一化比例增量（触摸位移 px / 父节点沿轴可分配长度）
 * @returns {boolean} 是否发生变化
 */
function setDividerRatios(tree, nodeId, index, base, delta) {
  const node = findNode(tree, nodeId);
  if (!node) return false;

  // 双侧最小占比钳制
  const clamped = Math.min(Math.max(delta, MIN_RATIO - base[0]), base[1] - MIN_RATIO);
  const newR0 = base[0] + clamped;
  const newR1 = base[1] - clamped;
  if (
    Math.abs(node.ratios[index] - newR0) < 1e-6 &&
    Math.abs(node.ratios[index + 1] - newR1) < 1e-6
  ) {
    return false;
  }
  node.ratios[index] = newR0;
  node.ratios[index + 1] = newR1;
  return true;
}

module.exports = {
  instantiateTree,
  countLeaves,
  findNode,
  computeLayout,
  applyDividerDrag,
  setDividerRatios
};
