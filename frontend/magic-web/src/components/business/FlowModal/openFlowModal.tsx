import { createRoot } from "react-dom/client"
import AppearanceProvider from "@/providers/AppearanceProvider"
import { BrowserRouter } from "@/routes/Router"
import { lazy, Suspense } from "react"

const FlowModal = lazy(() => import("./index"))

export function preloadFlowModal() {
	return import("./index")
}

export interface OpenFlowModalProps {
	/** 通用标识符，可以是 toolCode、agentId、subFlowId 等 */
	id: string
	/** 当流程发布完成时的回调 */
	onFlowPublished?: () => void
	/** 当FlowModal关闭时的回调（无论何种关闭方式） */
	onClose?: () => void
}

export function openFlowModal(props: OpenFlowModalProps) {
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

	function handleFlowPublished() {
		props?.onFlowPublished?.()
		onClose()
	}

	root.render(
		<AppearanceProvider>
			<BrowserRouter>
				<Suspense fallback={null}>
					<FlowModal
						open={true}
						id={props.id}
						onClose={onClose}
						onFlowPublished={handleFlowPublished}
					/>
				</Suspense>
			</BrowserRouter>
		</AppearanceProvider>,
	)

	return { onClose }
}
