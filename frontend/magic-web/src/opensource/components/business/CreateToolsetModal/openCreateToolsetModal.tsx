import { createRoot } from "react-dom/client"
import AppearanceProvider from "@/opensource/providers/AppearanceProvider"
import CreateToolsetModal from "./index"
import { FlowTool } from "@/opensource/types/flow"

export interface OpenCreateToolsetModalProps {
	onSuccess?: (data: FlowTool.Detail) => void
	/** 是否显示"仅创建"按钮，默认为true */
	showJustCreateButton?: boolean
	/** 是否显示"创建并添加工具"按钮，默认为true */
	showCreateAndAddToolButton?: boolean
	/** 工具创建成功后的回调，用于刷新列表 */
	onToolCreated?: (toolData: unknown) => void
	/** 工具创建模态框的按钮配置 */
	toolModalButtonConfig?: {
		showJustAddButton?: boolean
		showAddAndNextButton?: boolean
	}
}

export function openCreateToolsetModal(props: OpenCreateToolsetModalProps = {}) {
	const div = document.createElement("div")
	document.body.appendChild(div)

	const root = createRoot(div)

	function onClose() {
		// Use setTimeout to ensure uninstallation in the next event loop and avoid conflicts with React rendering
		setTimeout(() => {
			try {
				root.unmount()
			} catch (error) {
				console.warn("Error during root unmount:", error)
			}

			// 确保DOM元素安全移除
			if (div.parentNode) {
				div.parentNode.removeChild(div)
			}
		}, 0)
	}

	function handleSuccess(data: FlowTool.Detail) {
		props?.onSuccess?.(data)
		onClose()
	}

	root.render(
		<AppearanceProvider>
			<CreateToolsetModal
				open={true}
				onClose={onClose}
				onSuccess={handleSuccess}
				showJustCreateButton={props.showJustCreateButton}
				showCreateAndAddToolButton={props.showCreateAndAddToolButton}
				onToolCreated={props.onToolCreated}
				toolModalButtonConfig={props.toolModalButtonConfig}
			/>
		</AppearanceProvider>,
	)

	return { onClose }
}
