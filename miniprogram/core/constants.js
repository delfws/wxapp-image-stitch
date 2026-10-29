/**
 * 全局常量
 */

// 单元格最小占比（拖分割线时的钳制下限）
const MIN_RATIO = 0.15;

// 分割线视觉线粗（px）
const DIVIDER_LINE_WIDTH = 3;

// 分割线触摸热区宽度（px，视觉线居中）
const DIVIDER_HIT_SIZE = 24;

// 间距范围（px）
const GAP_MIN = 0;
const GAP_MAX = 40;

// 默认导出宽度（px）
const EXPORT_WIDTH = 1080;

// iOS canvas 上限保护：单边 / 总面积
const MAX_CANVAS_SIDE = 4096;
const MAX_CANVAS_PIXELS = 16000000;

// 外框比例预设
const ASPECTS = [
  { key: "1:1", value: 1, label: "1:1" },
  { key: "3:4", value: 3 / 4, label: "3:4" },
  { key: "4:3", value: 4 / 3, label: "4:3" },
  { key: "9:16", value: 9 / 16, label: "9:16" }
];

// 间距颜色色板（即画布底色）
const GAP_COLORS = [
  { name: "纯白", value: "#FFFFFF" },
  { name: "浅灰", value: "#F2F2F2" },
  { name: "米白", value: "#F7F3EA" },
  { name: "暖粉", value: "#E8D5D0" },
  { name: "雾蓝", value: "#D6E2EE" },
  { name: "薄荷", value: "#D9EAE3" },
  { name: "藏青", value: "#22303F" },
  { name: "炭黑", value: "#111111" }
];

module.exports = {
  MIN_RATIO,
  DIVIDER_LINE_WIDTH,
  DIVIDER_HIT_SIZE,
  GAP_MIN,
  GAP_MAX,
  EXPORT_WIDTH,
  MAX_CANVAS_SIDE,
  MAX_CANVAS_PIXELS,
  ASPECTS,
  GAP_COLORS
};
