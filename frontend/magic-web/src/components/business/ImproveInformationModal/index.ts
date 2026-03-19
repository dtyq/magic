// 组件导出
export { default as ImproveInformationModal } from "./component"

// 类型导出
export type { ImproveInformationModalProps, ImproveInformationData } from "./types"

// 工具方法导出
export {
	showImproveInformationModal,
	isImproveInformationModalOpen,
	forceCloseImproveInformationModal,
} from "./utils"

// 默认导出工具方法，方便直接调用
export { showImproveInformationModal as default } from "./utils"
