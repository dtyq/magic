# 报告 ECharts 5.6.0 规范 / Report ECharts 5.6.0 Specification

**仅适用于数据分析报告 / Only for data analysis reports**

仅使用 ECharts 5.6.0 规范。

<!--zh
- 生命周期：ECharts 初始化必须在 window.onload 后执行；若通过 script 动态插入 DOM 节点，必须在 requestAnimationFrame 回调中初始化 ECharts；监听 window.resize 触发 chart.resize()
- 坐标轴配置：数值轴必须设置 alignTicks: true
- 主题一致性：ECharts 主题与页面主题保持统一
- 仅使用 ECharts 5.6.0
-->

- Lifecycle: ECharts initialization must execute after window.onload; if DOM nodes dynamically inserted via script, must initialize ECharts in requestAnimationFrame callback; listen to window.resize to trigger chart.resize()
- Axis configuration: Numeric axis must set `alignTicks: true`
- Theme consistency: ECharts theme remains consistent with page theme
- Use ECharts 5.6.0 only
