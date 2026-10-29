/**
 * 预设布局库（纯数据模板）
 *
 * 树结构约定：
 *   内部节点 { d: 'row'|'col', ratios: [...], children: [...] }
 *     - d='row'：子项横向排列，ratios 为各子项宽度占比（和为 1）
 *     - d='col'：子项纵向排列，ratios 为各子项高度占比（和为 1）
 *   叶子节点 { leaf: true }，运行时由 tree.js 注入 leafIndex
 * aspect 为该模板默认外框宽高比（可被用户切换覆盖）
 *
 * 覆盖策略（每种张数涵盖全部典型拓扑）：
 *   等分（N竖列/N横行/行列矩阵）、一大N小（大图各方位）、
 *   行分割组合（2+3 / 3+4 / 4+5 等两行/两列/三行变体）、比例分割（黄金比等）
 */

const T = (d, ratios, children) => ({ d, ratios, children });
const L = () => ({ leaf: true });
const Ls = n => Array.from({ length: n }, () => L());
const eq = n => Array(n).fill(1 / n);

// 一大N小（大图在左，右侧为按 rows 数组逐行均分的列）
const bigLeft = (rows, r) => T("row", [r, 1 - r], [L(), T("col", eq(rows.length), rows.map(n => T("row", eq(n), Ls(n))))]);
// 一大N小（大图在右）
const bigRight = (rows, r) => T("row", [1 - r, r], [T("col", eq(rows.length), rows.map(n => T("row", eq(n), Ls(n)))), L()]);
// 一大N小（大图在上）
const bigTop = (rows, r) => T("col", [r, 1 - r], [L(), T("col", eq(rows.length), rows.map(n => T("row", eq(n), Ls(n))))]);
// 两行均分行（上行 a 张、下行 b 张）
const twoRows = (a, b, r) => T("col", [r, 1 - r], [T("row", eq(a), Ls(a)), T("row", eq(b), Ls(b))]);
// 两列均分行（左列 a 张、右列 b 张）
const twoCols = (a, b, r) => T("row", [r, 1 - r], [T("col", eq(a), Ls(a)), T("col", eq(b), Ls(b))]);
// 三行均分行
const threeRows = (a, b, c) => T("col", eq(3), [T("row", eq(a), Ls(a)), T("row", eq(b), Ls(b)), T("row", eq(c), Ls(c))]);

module.exports = [
  // ===== 2 张 =====
  { count: 2, name: "左右分", aspect: 1, tree: T("row", [0.5, 0.5], Ls(2)) },
  { count: 2, name: "上下分", aspect: 1, tree: T("col", [0.5, 0.5], Ls(2)) },
  { count: 2, name: "左大右小", aspect: 1, tree: T("row", [0.618, 0.382], Ls(2)) },
  { count: 2, name: "左小右大", aspect: 1, tree: T("row", [0.382, 0.618], Ls(2)) },
  { count: 2, name: "上大下小", aspect: 1, tree: T("col", [0.618, 0.382], Ls(2)) },
  { count: 2, name: "上小下大", aspect: 1, tree: T("col", [0.382, 0.618], Ls(2)) },
  { count: 2, name: "左宽右窄", aspect: 1, tree: T("row", [2 / 3, 1 / 3], Ls(2)) },
  { count: 2, name: "左窄右宽", aspect: 1, tree: T("row", [1 / 3, 2 / 3], Ls(2)) },
  { count: 2, name: "上宽下窄", aspect: 1, tree: T("col", [2 / 3, 1 / 3], Ls(2)) },
  { count: 2, name: "上窄下宽", aspect: 1, tree: T("col", [1 / 3, 2 / 3], Ls(2)) },

  // ===== 3 张 =====
  { count: 3, name: "三竖列", aspect: 1, tree: T("row", eq(3), Ls(3)) },
  { count: 3, name: "三横行", aspect: 1, tree: T("col", eq(3), Ls(3)) },
  { count: 3, name: "上一下二", aspect: 1, tree: T("col", [0.5, 0.5], [L(), T("row", [0.5, 0.5], Ls(2))]) },
  { count: 3, name: "上二下一", aspect: 1, tree: T("col", [0.5, 0.5], [T("row", [0.5, 0.5], Ls(2)), L()]) },
  { count: 3, name: "左一右二", aspect: 1, tree: T("row", [0.5, 0.5], [L(), T("col", [0.5, 0.5], Ls(2))]) },
  { count: 3, name: "左二右一", aspect: 1, tree: T("row", [0.5, 0.5], [T("col", [0.5, 0.5], Ls(2)), L()]) },
  { count: 3, name: "上大下二小", aspect: 4 / 3, tree: T("col", [0.62, 0.38], [L(), T("row", eq(2), Ls(2))]) },
  { count: 3, name: "左大右二小", aspect: 3 / 4, tree: T("row", [0.62, 0.38], [L(), T("col", eq(2), Ls(2))]) },
  { count: 3, name: "中宽侧窄", aspect: 1, tree: T("row", [0.28, 0.44, 0.28], Ls(3)) },
  { count: 3, name: "中高侧矮", aspect: 1, tree: T("col", [0.28, 0.44, 0.28], Ls(3)) },
  { count: 3, name: "左一右二(宽)", aspect: 3 / 4, tree: T("row", [0.618, 0.382], [L(), T("col", eq(2), Ls(2))]) },
  { count: 3, name: "上双下大", aspect: 4 / 3, tree: T("col", [0.38, 0.62], [T("row", eq(2), Ls(2)), L()]) },
  { count: 3, name: "左双右大", aspect: 4 / 3, tree: T("row", [0.38, 0.62], [T("col", eq(2), Ls(2)), L()]) },

  // ===== 4 张 =====
  {
    count: 4, name: "田字格", aspect: 1,
    tree: T("col", [0.5, 0.5], [T("row", [0.5, 0.5], Ls(2)), T("row", [0.5, 0.5], Ls(2))])
  },
  { count: 4, name: "四竖列", aspect: 1, tree: T("row", eq(4), Ls(4)) },
  { count: 4, name: "四横行", aspect: 1, tree: T("col", eq(4), Ls(4)) },
  { count: 4, name: "一大三小", aspect: 1, tree: bigLeft([2, 1], 0.5) },
  { count: 4, name: "左三右一", aspect: 1, tree: bigRight([2, 1], 0.5) },
  { count: 4, name: "上一下三", aspect: 3 / 4, tree: T("col", [0.4, 0.6], [L(), T("row", eq(3), Ls(3))]) },
  { count: 4, name: "上三下一", aspect: 3 / 4, tree: T("col", [0.6, 0.4], [T("row", eq(3), Ls(3)), L()]) },
  { count: 4, name: "上大下三小", aspect: 4 / 3, tree: T("col", [0.62, 0.38], [L(), T("row", eq(3), Ls(3))]) },
  { count: 4, name: "上三小下大", aspect: 4 / 3, tree: T("col", [0.62, 0.38], [T("row", eq(3), Ls(3)), L()]) },
  { count: 4, name: "左三小右大", aspect: 4 / 3, tree: T("row", [0.38, 0.62], [T("col", eq(3), Ls(3)), L()]) },
  { count: 4, name: "田字左宽", aspect: 1, tree: T("col", eq(2), [T("row", [0.618, 0.382], Ls(2)), T("row", [0.618, 0.382], Ls(2))]) },
  { count: 4, name: "田字上高", aspect: 1, tree: T("col", [0.618, 0.382], [T("row", eq(2), Ls(2)), T("row", eq(2), Ls(2))]) },
  { count: 4, name: "双列左宽", aspect: 1, tree: twoCols(2, 2, 0.618) },
  { count: 4, name: "上一中二下一", aspect: 3 / 4, tree: threeRows(1, 2, 1) },

  // ===== 5 张 =====
  { count: 5, name: "左一右四", aspect: 1, tree: bigLeft([2, 2], 0.5) },
  { count: 5, name: "左四右一", aspect: 1, tree: bigRight([2, 2], 0.5) },
  { count: 5, name: "上一下四", aspect: 1, tree: T("col", [0.5, 0.5], [L(), T("row", eq(4), Ls(4))]) },
  { count: 5, name: "上四下一", aspect: 1, tree: T("col", [0.5, 0.5], [T("row", eq(4), Ls(4)), L()]) },
  { count: 5, name: "上二下三", aspect: 3 / 4, tree: twoRows(2, 3, 0.45) },
  { count: 5, name: "上三下二", aspect: 3 / 4, tree: twoRows(3, 2, 0.55) },
  { count: 5, name: "左二右三", aspect: 1, tree: twoCols(2, 3, 0.45) },
  { count: 5, name: "左三右二", aspect: 1, tree: twoCols(3, 2, 0.55) },
  { count: 5, name: "五竖列", aspect: 1, tree: T("row", eq(5), Ls(5)) },
  { count: 5, name: "五横行", aspect: 1, tree: T("col", eq(5), Ls(5)) },
  { count: 5, name: "左大右四小(宽)", aspect: 4 / 3, tree: bigLeft([2, 2], 0.618) },
  { count: 5, name: "上一中三下一", aspect: 3 / 4, tree: threeRows(1, 3, 1) },
  { count: 5, name: "上二中一下二", aspect: 1, tree: threeRows(2, 1, 2) },
  { count: 5, name: "上二中二下一", aspect: 3 / 4, tree: threeRows(2, 2, 1) },
  { count: 5, name: "上一下二中二", aspect: 3 / 4, tree: threeRows(1, 2, 2) },

  // ===== 6 张 =====
  { count: 6, name: "两行三列", aspect: 4 / 3, tree: twoRows(3, 3, 0.5) },
  { count: 6, name: "三行二列", aspect: 3 / 4, tree: threeRows(2, 2, 2) },
  { count: 6, name: "一大五小", aspect: 1, tree: bigLeft([3, 2], 0.5) },
  { count: 6, name: "左五右一", aspect: 1, tree: bigRight([3, 2], 0.5) },
  { count: 6, name: "上大下五小", aspect: 1, tree: bigTop([3, 2], 0.5) },
  { count: 6, name: "上一下五", aspect: 1, tree: T("col", [0.5, 0.5], [L(), T("row", eq(5), Ls(5))]) },
  { count: 6, name: "上五下一", aspect: 1, tree: T("col", [0.5, 0.5], [T("row", eq(5), Ls(5)), L()]) },
  { count: 6, name: "左二右四", aspect: 1, tree: twoCols(2, 4, 0.4) },
  { count: 6, name: "左四右二", aspect: 1, tree: twoCols(4, 2, 0.6) },
  { count: 6, name: "上一中二下三", aspect: 1, tree: threeRows(1, 2, 3) },
  { count: 6, name: "上三中二下一", aspect: 1, tree: threeRows(3, 2, 1) },
  { count: 6, name: "上二下四", aspect: 3 / 4, tree: twoRows(2, 4, 0.38) },
  { count: 6, name: "上四下二", aspect: 4 / 3, tree: twoRows(4, 2, 0.62) },
  { count: 6, name: "左大右五小(宽)", aspect: 4 / 3, tree: bigLeft([3, 2], 0.618) },

  // ===== 7 张 =====
  { count: 7, name: "一大六小", aspect: 1, tree: bigLeft([3, 3], 0.45) },
  { count: 7, name: "左六右一", aspect: 1, tree: bigRight([3, 3], 0.45) },
  { count: 7, name: "上大下六小", aspect: 1, tree: bigTop([3, 3], 0.45) },
  { count: 7, name: "上四下三", aspect: 4 / 3, tree: twoRows(4, 3, 0.55) },
  { count: 7, name: "上三下四", aspect: 3 / 4, tree: twoRows(3, 4, 0.45) },
  { count: 7, name: "上三中二下二", aspect: 1, tree: threeRows(3, 2, 2) },
  { count: 7, name: "上二中二下三", aspect: 1, tree: threeRows(2, 2, 3) },
  { count: 7, name: "左三右四", aspect: 1, tree: twoCols(3, 4, 0.45) },
  { count: 7, name: "左四右三", aspect: 1, tree: twoCols(4, 3, 0.55) },
  { count: 7, name: "左大右六小(三排)", aspect: 1, tree: bigLeft([2, 2, 2], 0.45) },
  { count: 7, name: "上大下六小(三排)", aspect: 4 / 3, tree: bigTop([2, 2, 2], 0.45) },
  { count: 7, name: "上二中三下二", aspect: 1, tree: threeRows(2, 3, 2) },
  { count: 7, name: "上一中二下四", aspect: 3 / 4, tree: threeRows(1, 2, 4) },
  { count: 7, name: "上四中二下一", aspect: 4 / 3, tree: threeRows(4, 2, 1) },

  // ===== 8 张 =====
  { count: 8, name: "两行四列", aspect: 4 / 3, tree: twoRows(4, 4, 0.5) },
  {
    count: 8, name: "四行二列", aspect: 3 / 4,
    tree: T("col", eq(4), [
      T("row", [0.5, 0.5], Ls(2)),
      T("row", [0.5, 0.5], Ls(2)),
      T("row", [0.5, 0.5], Ls(2)),
      T("row", [0.5, 0.5], Ls(2))
    ])
  },
  { count: 8, name: "一大七小", aspect: 1, tree: bigLeft([4, 3], 0.4) },
  { count: 8, name: "左七右一", aspect: 1, tree: bigRight([4, 3], 0.4) },
  { count: 8, name: "上大下七小", aspect: 1, tree: bigTop([4, 3], 0.4) },
  { count: 8, name: "左三右五", aspect: 1, tree: twoCols(3, 5, 0.45) },
  { count: 8, name: "左五右三", aspect: 1, tree: twoCols(5, 3, 0.55) },
  { count: 8, name: "上三下五", aspect: 1, tree: twoRows(3, 5, 0.42) },
  { count: 8, name: "上五下三", aspect: 1, tree: twoRows(5, 3, 0.58) },
  { count: 8, name: "上二中四下二", aspect: 1, tree: threeRows(2, 4, 2) },
  { count: 8, name: "上三中三下二", aspect: 1, tree: threeRows(3, 3, 2) },
  { count: 8, name: "上二中三下三", aspect: 1, tree: threeRows(2, 3, 3) },
  { count: 8, name: "左大右七小(三排)", aspect: 1, tree: bigLeft([2, 2, 3], 0.4) },
  { count: 8, name: "上大下七小(三排)", aspect: 4 / 3, tree: bigTop([2, 3, 2], 0.4) },
  { count: 8, name: "上四下四(宽)", aspect: 4 / 3, tree: twoRows(4, 4, 0.62) },

  // ===== 9 张 =====
  { count: 9, name: "九宫格", aspect: 1, tree: threeRows(3, 3, 3) },
  { count: 9, name: "一大八小", aspect: 1, tree: bigLeft([4, 4], 0.4) },
  { count: 9, name: "左八右一", aspect: 1, tree: bigRight([4, 4], 0.4) },
  { count: 9, name: "上大下八小", aspect: 1, tree: bigTop([4, 4], 0.4) },
  { count: 9, name: "上四下五", aspect: 1, tree: twoRows(4, 5, 0.45) },
  { count: 9, name: "上五下四", aspect: 1, tree: twoRows(5, 4, 0.55) },
  { count: 9, name: "左四右五", aspect: 1, tree: twoCols(4, 5, 0.45) },
  { count: 9, name: "左五右四", aspect: 1, tree: twoCols(5, 4, 0.55) },
  { count: 9, name: "上四中二下三", aspect: 1, tree: threeRows(4, 2, 3) },
  { count: 9, name: "上二中三下四", aspect: 1, tree: threeRows(2, 3, 4) },
  { count: 9, name: "上一中四下四", aspect: 1, tree: threeRows(1, 4, 4) },
  { count: 9, name: "上四中四下一", aspect: 1, tree: threeRows(4, 4, 1) },
  { count: 9, name: "上三下六", aspect: 3 / 4, tree: twoRows(3, 6, 0.35) },
  { count: 9, name: "左三右六", aspect: 1, tree: twoCols(3, 6, 0.35) },
  { count: 9, name: "左大右八小(三排)", aspect: 1, tree: bigLeft([2, 3, 3], 0.4) }
];
