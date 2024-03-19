/**
 * 视口变换参数
 */
export interface ViewportTransform {
  /** x轴位移 */
  x: number;
  /** y轴位移 */
  y: number;
  /** 缩放比例 */
  zoom: number;
}

/**
 * 辅助线配置选项
 */
export interface HelperLinesOptions {
  /** 对齐阈值，节点之间距离小于该值时触发对齐，默认为5 */
  threshold?: number;
  /** 辅助线颜色，默认为#ff0071 */
  color?: string;
  /** 辅助线宽度，默认为1 */
  lineWidth?: number;
  /** 辅助线z-index，默认为9999 */
  zIndex?: number;
  /** 是否启用节点吸附功能，默认为true */
  enableSnap?: boolean;
} 