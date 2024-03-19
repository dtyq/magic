import { createRoot } from "react-dom/client"
import AppearanceProvider from "@/opensource/providers/AppearanceProvider"
import CreateToolModal from "./index"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"

export interface OpenCreateToolModalProps {
	toolsetId: string
	onSuccess?: (data: MagicFlow.Flow) => void
	/** 是否显示"仅添加"按钮，默认为true */
	showJustAddButton?: boolean
	/** 是否显示"添加并下一步"按钮，默认为true */
	showAddAndNextButton?: boolean
	/** 当流程发布完成时的回调 */
	onFlowPublished?: () => void
}

export function openCreateToolModal(props: OpenCreateToolModalProps) {
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

	function handleSuccess(data: MagicFlow.Flow) {
		props?.onSuccess?.(data)
		onClose()
	}

	root.render(
		<AppearanceProvider>
			<CreateToolModal
				open={true}
				toolsetId={props.toolsetId}
				onClose={onClose}
				onSuccess={handleSuccess}
				showJustAddButton={props.showJustAddButton}
				showAddAndNextButton={props.showAddAndNextButton}
				onFlowPublished={props.onFlowPublished}
			/>
		</AppearanceProvider>,
	)

	return { onClose }
}
