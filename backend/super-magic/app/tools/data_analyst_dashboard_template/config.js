// Dashboard configuration
const DASHBOARD_CONFIG = {
  // Base font size
  BASE_FONT_SIZE: "12px",
  // Grid column count, defines horizontal division quantity
  GRID_COLS: 24,
  // Default row height (pixels), base height for each grid cell
  GRID_DEFAULT_ROW_HEIGHT: 32,
  // Page background color
  BODY_BACKGROUND: "#ffffff",
  // Page gradient background image, css background-image property
  BODY_BACKGROUND_IMAGE: ["linear-gradient(135deg, rgba(49, 92, 236, 0.04) 0%, rgba(248, 250, 252, 0.6) 50%, #ffffff 100%)", "radial-gradient(circle at 15% 85%, rgba(49, 92, 236, 0.06) 0%, transparent 40%)", "radial-gradient(circle at 85% 15%, rgba(49, 92, 236, 0.03) 0%, transparent 40%)"],
  // Page font family
  BODY_FONT_FAMILY: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimSun", sans-serif',
  // Primary color
  COLORS_PRIMARY: "#8674ff",
  // Success status color
  COLORS_SUCCESS: "#52c41a",
  // Warning status color
  COLORS_WARNING: "#faad14",
  // Error status color
  COLORS_ERROR: "#ff4d4f",
  // Primary text color
  COLORS_TEXT_PRIMARY: "rgba(28, 29, 35, 1)",
  // Secondary text color
  COLORS_TEXT_SECONDARY: "rgba(28, 29, 35, 0.8)",
  // Tertiary text color
  COLORS_TEXT_THIRD: "rgba(28, 29, 35, 0.6)",
  // Border color
  COLORS_BORDER: "rgba(28, 29, 35, 0.08)",
  // Card background color
  CARD_BACKGROUND: "rgba(255, 255, 255, 1)",
  // Card title font size
  CARD_TITLE_FONT_SIZE: "14px",
  // Table header background color
  TABLE_HEADER_BACKGROUND_COLOR: "#8674ff",
  // ECharts color palette
  ECHARTS_COLOR: ["#8674ff", "#4c9dff", "#57c7e6", "#4cc9a6", "#3e7d6b", "#f3bd51", "#fd905a", "#e65454", "#f3738c", "#c34b9d", "#7a89a6", "#4c4c5c"],
  // Metric card icon type: circle, normal
  METRIC_CARD_ICON_TYPE: "circle",
};

window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;
