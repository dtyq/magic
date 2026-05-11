import { lazy, Suspense, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import AppearanceProvider from "@/providers/AppearanceProvider"

const MicrophonePermissionDialog = lazy(() => import("./index"))

interface ShowMicrophonePermissionDialogOptions {
	title: string
	description: string
	instructions: string
	confirmText: string
	cancelText: string
	onConfirm?: () => void
	onClose?: () => void
}

let modalContainer: HTMLDivElement | null = null
let modalRoot: Root | null = null

export function showMicrophonePermissionDialog(
	options: ShowMicrophonePermissionDialogOptions,
): Promise<void> {
	return new Promise((resolve) => {
		if (modalContainer && modalRoot) closeModal()

		modalContainer = document.createElement("div")
		modalContainer.id = "microphone-permission-dialog-container"
		modalContainer.style.position = "relative"
		modalContainer.style.zIndex = "1000"
		document.body.appendChild(modalContainer)

		modalRoot = createRoot(modalContainer)

		const DialogContainer = () => {
			const [open, setOpen] = useState(true)

			const handleClose = () => {
				setOpen(false)
				options.onClose?.()
				setTimeout(() => {
					closeModal()
					resolve()
				}, 200)
			}

			const handleConfirm = () => {
				setOpen(false)
				options.onConfirm?.()
				setTimeout(() => {
					closeModal()
					resolve()
				}, 200)
			}

			return (
				<Suspense fallback={null}>
					<MicrophonePermissionDialog
						open={open}
						title={options.title}
						description={options.description}
						instructions={options.instructions}
						confirmText={options.confirmText}
						cancelText={options.cancelText}
						onClose={handleClose}
						onConfirm={handleConfirm}
					/>
				</Suspense>
			)
		}

		modalRoot.render(
			<AppearanceProvider>
				<DialogContainer />
			</AppearanceProvider>,
		)
	})
}

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
