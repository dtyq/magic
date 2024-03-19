import { createRoot, type Root } from "react-dom/client"
import AppearanceProvider from "@/opensource/providers/AppearanceProvider"
import { type AgentCommonModalProps, AgentCommonModalRef } from "./types"
import { userStore } from "@/opensource/models/user"
import { reaction } from "mobx"
import { createRef, lazy, Suspense } from "react"

const AgentCommonModal = lazy(() =>
	import("./AgentCommonModal").then((module) => ({
		default: module.AgentCommonModal,
	})),
)

// Global registry to track active modals and prevent conflicts
interface ModalInstance {
	div: HTMLDivElement
	root: Root
	disposer: () => void
	isCleaningUp: boolean
}

const activeModals = new Set<ModalInstance>()

export function openAgentCommonModal(props: AgentCommonModalProps) {
	const div = document.createElement("div")
	document.body.appendChild(div)

	const root = createRoot(div)
	const modalRef = createRef<AgentCommonModalRef>()

	const disposer = reaction(
		() => [userStore.user.organizationCode, userStore.user.userInfo?.magic_id],
		() => {
			handleClose()
		},
	)

	// Register this modal instance
	const instance: ModalInstance = {
		div,
		root,
		disposer,
		isCleaningUp: false,
	}
	activeModals.add(instance)

	function handleClose() {
		// Prevent duplicate cleanup
		if (instance.isCleaningUp) return

		instance.isCleaningUp = true

		// Clean up after modal animation completes
		// Both desktop (afterClose) and mobile (setTimeout in component) ensure animation is done
		try {
			// Dispose MobX reaction
			instance.disposer()

			// Unmount React tree
			instance.root.unmount()

			// Remove DOM element
			if (instance.div.parentNode) {
				instance.div.parentNode.removeChild(instance.div)
			}

			// Unregister from active modals
			activeModals.delete(instance)
		} catch (error) {
			console.warn("Error during cleanup:", error)
			activeModals.delete(instance)
		}
	}

	root.render(
		<AppearanceProvider>
			<Suspense fallback={null}>
				<AgentCommonModal
					{...props}
					ref={modalRef}
					getContainer={() => div}
					onClose={() => {
						props?.onClose?.()
						handleClose()
					}}
					maskClosable={false}
				/>
			</Suspense>
		</AppearanceProvider>,
	)

	return { onClose: () => modalRef.current?.close() }
}

export type { AgentCommonModalChildrenProps, AgentCommonModalProps } from "./types"

export { AgentCommonModal } from "./AgentCommonModal"
