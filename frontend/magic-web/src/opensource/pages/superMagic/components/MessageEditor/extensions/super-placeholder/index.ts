// 主入口文件 - 导出所有公共 API

// 类型定义
export type { SuperPlaceholderAttrs, SuperPlaceholderOptions, Editor } from "./types"

// 扩展组件
export { SuperPlaceholderExtension } from "./extension"

// React 组件
export { SuperPlaceholderComponent } from "./component"

// 样式 Hook
export { useStyles } from "./styles"

// 工具函数
export {
	validateSuperPlaceholderAttrs,
	sanitizeSuperPlaceholderAttrs,
	getDisplayText,
	isEmptySuperPlaceholder,
	calculateStringWidth,
} from "./utils"

// 默认导出扩展
export { SuperPlaceholderExtension as default } from "./extension"
