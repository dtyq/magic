import { createRoot, type Root } from "react-dom/client"
import { lazy, Suspense, useState } from "react"
import AppearanceProvider from "@/opensource/providers/AppearanceProvider"
import type { ShowWaitingTipModalOptions } from "./types"

const WaitingTipModal = lazy(() => import("./component"))

let modalContainer: HTMLDivElement | null = null
let modalRoot: Root | null = null

/**
 * Display waiting tip modal dynamically
 * @param options Configuration options
 * @returns Promise that resolves when modal is closed
 */
export function showWaitingTipModal(options: ShowWaitingTipModalOptions = {}): Promise<void> {
	return new Promise((resolve) => {
		// Clean up existing modal if any
		if (modalContainer && modalRoot) {
			closeModal()
		}

		// Create container element
		modalContainer = document.createElement("div")
		modalContainer.id = "waiting-tip-modal-container"
		modalContainer.style.position = "relative"
		modalContainer.style.zIndex = "1000"
		document.body.appendChild(modalContainer)

		// Create React root
		modalRoot = createRoot(modalContainer)

		// Render modal component
		const ModalComponent = () => {
			const [open, setOpen] = useState(true)

			const handleClose = () => {
				setOpen(false)
				options.onClose?.()
				setTimeout(() => {
					closeModal()
				}, 200)
				resolve()
			}

			return (
				<Suspense fallback={null}>
					<WaitingTipModal
						open={open}
						onClose={handleClose}
						projectName={options.projectName}
						workspaceName={options.workspaceName}
					/>
				</Suspense>
			)
		}

		modalRoot.render(
			<AppearanceProvider>
				<ModalComponent />
			</AppearanceProvider>,
		)
	})
}

/**
 * Close and clean up the modal
 */
function closeModal() {
	if (modalRoot) {
		modalRoot.unmount()
		modalRoot = null
	}

	if (modalContainer && document.body.contains(modalContainer)) {
		document.body.removeChild(modalContainer)
		modalContainer = null
	}
}

export default showWaitingTipModal
