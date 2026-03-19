# 更新日志

## [1.2.0] - URI Malformed 修复

### 🐛 问题修复
- **修复 URI malformed 错误**：解决 SVG 内容包含特殊字符时的渲染问题
- **增强错误处理**：添加完善的异常捕获和降级处理机制
- **改进 SVG 解码**：支持 base64 和 URL 编码的 SVG 内容安全解码

### 🔧 技术改进
- **新增 SVG 处理工具**：`utils/svgProcessor.ts`
  - 安全的 data URL 解码
  - SVG 内容验证和清理
  - URI 字符处理和修复
  - 完善的错误报告机制

- **智能降级策略**：
  - SVG 解析失败时自动降级为 `<img>` 标签
  - 保持用户体验的连续性
  - 详细的错误日志记录

### 🧪 测试增强
- 新增 SVG 处理工具的完整测试覆盖
- 测试各种 SVG 格式和编码方式
- 验证错误处理和降级机制

---

## [1.1.0] - SVG 支持增强

### 🆕 新增功能
- **增强的 SVG 预览支持**：参考 PC 端逻辑实现
  - 支持 `svg` 和 `svg+xml` 文件扩展名检测
  - 支持多种 SVG URL 格式检测
  - 优先使用文件信息进行格式判断，提高准确性

### 🔧 技术改进
- **SVG 检测逻辑优化**：
  ```typescript
  // 增强的检测逻辑
  const fileExt = info?.ext?.ext || ""
  const isSvgByExtension = fileExt === "svg" || fileExt === "svg+xml"
  const isSvgByUrl = src.includes("data:image/svg") || src.endsWith(".svg")
  const isSvg = isSvgByExtension || isSvgByUrl
  ```

- **渲染机制改进**：
  - 使用 `useMemo` 优化 SVG 渲染性能
  - 统一的 ImageNode 组件，便于维护
  - 专门的 SVG 容器样式，确保正确显示

- **下载功能增强**：
  - SVG 文件自动转换为 PNG 格式下载
  - 保持高分辨率 (2000x2000)
  - 文件名和格式信息保持一致

### 🎨 样式优化
- SVG 容器添加 16px 内边距，避免边缘裁剪
- 改进 SVG 自适应逻辑，更好地处理不同尺寸
- 增加对动态 SVG 内容的样式支持

### 🧪 测试覆盖
- 新增 SVG 格式检测测试用例
- 测试文件扩展名优先级逻辑
- 验证不同 SVG URL 格式的渲染

### 📖 文档更新
- 详细的 SVG 支持说明
- 技术实现原理解释
- 使用示例和最佳实践

---

## [1.0.0] - 初始版本

### 🚀 首次发布
- 基于 PC 端功能实现移动端图片预览
- 支持基本的图片格式预览
- 下载、高清转换、定位消息等功能
- 使用 antd-mobile、antd-style、ahooks 技术栈
- 完整的组件架构和测试覆盖 