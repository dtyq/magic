// Dashboard configuration
window.DASHBOARD_CONFIG = {
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

// Get ECharts theme configuration, dashboardConfig is window.DASHBOARD_CONFIG
window.GET_ECHARTS_THEME_CONFIG = function (dashboardConfig) {
  var fontFamily = dashboardConfig.BODY_FONT_FAMILY;
  var fontSize = parseFloat(dashboardConfig.BASE_FONT_SIZE);
  var fontSizeSecondary = fontSize - 2;
  var fontSizeWithPixel = `${fontSize}px`;
  var fontSizeSecondaryWithPixel = `${fontSizeSecondary}px`;
  var colorTextPrimary = dashboardConfig.COLORS_TEXT_PRIMARY;
  var colorTextSecondary = dashboardConfig.COLORS_TEXT_SECONDARY;
  var colorTextThird = dashboardConfig.COLORS_TEXT_THIRD;
  var colorBorder = dashboardConfig.COLORS_BORDER;
  var colorPrimary = dashboardConfig.COLORS_PRIMARY;
  var color = dashboardConfig.ECHARTS_COLOR.slice();

  return {
    color,
    backgroundColor: "transparent",
    textStyle: {
      color: colorTextPrimary,
      fontFamily: fontFamily,
      fontSize: fontSizeWithPixel,
    },
    title: {
      textStyle: {
        color: colorTextPrimary,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
      subtextStyle: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeSecondaryWithPixel,
      },
    },
    legend: {
      type: "scroll",
      itemWidth: 20,
      itemHeight: 11.2,
      textStyle: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
    },
    categoryAxis: {
      axisLine: {
        lineStyle: { color: colorBorder },
      },
      axisTick: {
        lineStyle: { color: colorBorder },
      },
      axisLabel: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
        hideOverlap: true,
      },
      nameTextStyle: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
      splitLine: {
        show: false,
        lineStyle: { color: colorBorder },
      },
    },
    valueAxis: {
      alignTicks: true,
      axisLine: {
        lineStyle: { color: colorBorder },
      },
      axisTick: {
        lineStyle: { color: colorBorder },
      },
      axisLabel: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
        hideOverlap: true,
      },
      nameTextStyle: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
      splitLine: {
        lineStyle: { color: colorBorder },
      },
    },
    toolbox: {
      iconStyle: {
        colorBorder: colorTextThird,
      },
      emphasis: {
        iconStyle: {
          colorBorder: colorBorder,
        },
      },
    },
    tooltip: {
      appendTo: "body",
      appendToBody: true,
      renderMode: "html",
      className: "echarts-tooltip",
      backgroundColor: dashboardConfig.CARD_BACKGROUND,
      padding: 6,
      textStyle: {
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
        color: colorTextThird,
      },
      axisPointer: {
        label: {
          backgroundColor: colorPrimary,
        },
      },
    },
    pie: {
      label: {
        color: colorTextSecondary,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
      labelLine: {
        lineStyle: {
          color: colorBorder,
        },
      },
    },
    bar: {
      label: {
        color: colorTextSecondary,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
    },
    line: {
      label: {
        color: colorTextSecondary,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
    },
    geo: {
      label: {
        color: colorTextSecondary,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
    },
    scatter: {
      label: {
        color: colorTextSecondary,
        fontFamily: fontFamily,
        fontSize: fontSizeWithPixel,
      },
    },
    visualMap: {
      padding: 0,
      textStyle: {
        color: colorTextThird,
        fontFamily: fontFamily,
        fontSize: fontSizeSecondaryWithPixel,
      },
    },
  };
};
