import { ModalProps } from "antd"

// 定义子组件应该接受的props类型

export interface AgentCommonModalChildrenProps {
	onClose?: () => void
	/** 是否遵循响应式交互 */
	isResponsive?: boolean
}

export type AgentCommonModalProps = AgentCommonModalChildrenProps &
	Omit<ModalProps, "open"> & {
		/**
		 * 受控模式：控制弹窗显示/隐藏
		 * 不传则为非受控模式（挂载即打开）
		 */
		open?: boolean
		/**
		 * 受控模式：弹窗状态变化回调
		 */
		onOpenChange?: (open: boolean) => void
	}

export interface AgentCommonModalRef {
	close: () => void
}
