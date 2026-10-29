/**
 * core 纯函数快速验证（Node 环境跑，非小程序运行时）
 * 用法: node core/selftest.js
 */
const tree = require("./tree");
const layouts = require("./layouts");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  }
}

// 1. 所有模板叶子数正确、ratios 和为 1
for (const tpl of layouts) {
  const inst = tree.instantiateTree(tpl.tree);
  const leaves = tree.countLeaves(inst);
  assert(leaves === tpl.count, `模板「${tpl.name}」叶子数 ${leaves} != ${tpl.count}`);
}

(function checkRatios(node, name) {
  if (node.leaf) return;
  const sum = node.ratios.reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1) < 1e-9, `模板「${name}」节点 ${node.nodeId} ratios 和为 ${sum}`);
  node.children.forEach(c => checkRatios(c, name));
});

for (const tpl of layouts) {
  const inst = tree.instantiateTree(tpl.tree);
  (function check(node) {
    if (node.leaf) return;
    const sum = node.ratios.reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 1) < 1e-9, `模板「${tpl.name}」节点 ratios 和为 ${sum}`);
    node.children.forEach(check);
  })(inst);
}

// 2. 田字格布局计算：2x2，外框 100x100，gap=0
const grid = layouts.find(l => l.name === "田字格");
const inst = tree.instantiateTree(grid.tree);
const r0 = tree.computeLayout(inst, 0, 100, 100);
assert(r0.leafFrames.length === 4, "田字格应有 4 个 leafFrame");
const f = r0.leafFrames;
assert(f[0].left === 0 && f[0].top === 0 && f[0].width === 50 && f[0].height === 50, "左上格 frame 错误");
assert(f[1].left === 50 && f[1].top === 0, "右上格 frame 错误");
assert(f[3].left === 50 && f[3].top === 50, "右下格 frame 错误");
assert(r0.dividers.length === 3, `田字格应有 3 条分割线（root col 1 条 + 两个 row 各 1 条），实际 ${r0.dividers.length}`);

// 3. gap 扣减：外框 100，2 列 gap=10 → 每格宽 45
const pair = tree.instantiateTree({ d: "row", ratios: [0.5, 0.5], children: [{ leaf: true }, { leaf: true }] });
const r1 = tree.computeLayout(pair, 10, 100, 100);
assert(r1.leafFrames[0].width === 45, `gap 扣减错误: ${r1.leafFrames[0].width}`);
assert(r1.leafFrames[1].left === 55, `gap 偏移错误: ${r1.leafFrames[1].left}`);
assert(r1.dividers[0].frame.left === 45 && r1.dividers[0].frame.width === 10, "divider frame 错误");

// 4. 拖分割线：比例更新 + 钳制
const dragTree = tree.instantiateTree({ d: "row", ratios: [0.5, 0.5], children: [{ leaf: true }, { leaf: true }] });
tree.applyDividerDrag(dragTree, "n0", 0, 0.2);
assert(Math.abs(dragTree.ratios[0] - 0.7) < 1e-9, "拖动后 ratios[0] 应为 0.7");
// 超限钳制：0.7 已超过 1-0.15=0.85 边界内，先试拖到 0.95
tree.applyDividerDrag(dragTree, "n0", 0, 0.5);
assert(Math.abs(dragTree.ratios[0] - 0.85) < 1e-9, `钳制失败: ${dragTree.ratios[0]}`);
// 反向钳制
tree.applyDividerDrag(dragTree, "n0", 0, -2);
assert(Math.abs(dragTree.ratios[0] - 0.15) < 1e-9, `反向钳制失败: ${dragTree.ratios[0]}`);
assert(Math.abs(dragTree.ratios[0] + dragTree.ratios[1] - 1) < 1e-9, "ratios 和不为 1");

// 5. 父子隔离：拖子节点分割线不影响父节点
const nested = tree.instantiateTree({
  d: "col", ratios: [0.5, 0.5],
  children: [
    { leaf: true },
    { d: "row", ratios: [0.5, 0.5], children: [{ leaf: true }, { leaf: true }] }
  ]
});
const r2 = tree.computeLayout(nested, 0, 100, 100);
// 找到子节点（n1）的分割线
const subDivider = r2.dividers.find(d => d.nodeId === "n1");
assert(subDivider && subDivider.parentFrame.top === 50, "子节点 parentFrame 错误");
tree.applyDividerDrag(nested, "n1", 0, 0.1);
assert(Math.abs(nested.ratios[0] - 0.5) < 1e-9, "父节点 ratios 被误改");

console.log(failed === 0 ? "✓ 全部 " + layouts.length + " 个布局模板与核心函数测试通过" : `✗ ${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
