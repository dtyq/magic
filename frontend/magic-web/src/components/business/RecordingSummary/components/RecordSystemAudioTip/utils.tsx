import { createRoot, type Root } from "react-dom/client"
import { lazy, Suspense, useState } from "react"
import AppearanceProvider from "@/providers/AppearanceProvider"
import { platformKey } from "@/utils/storage"
import { userStore } from "@/models/user"

const RecordSystemAudioTip = lazy(() => import("./index"))

let modalContainer: HTMLDivElement | null = null
let modalRoot: Root | null = null

const STORAGE_KEY = () =>
	platformKey(`record_system_audio_tip_dont_show_again:${userStore.user.userInfo?.user_id}`)

/**
 * Check if user has chosen not to show the tip again
 */
function shouldShowTip(): boolean {
	if (typeof window === "undefined") return true

	try {
		const stored = localStorage.getItem(STORAGE_KEY())
		return stored !== "true"
	} catch (error) {
		console.error("Failed to check record system audio tip preference:", error)
		return true
	}
}

/**
 * Save user preference to not show the tip again
 */
function saveDontShowAgainPreference() {
	if (typeof window === "undefined") return

	try {
		localStorage.setItem(STORAGE_KEY(), "true")
	} catch (error) {
		console.error("Failed to save record system audio tip preference:", error)
	}
}

/**
 * Display record system audio tip modal dynamically
 * @returns Promise that resolves when modal is closed
 * If user has chosen not to show again, the promise resolves immediately without showing the modal
 */
export function showRecordSystemAudioTip(): Promise<void> {
	return new Promise((resolve) => {
		// Check if user has chosen not to show again
		if (!shouldShowTip()) {
			resolve()
			return
		}

		// Clean up existing modal if any
		if (modalContainer && modalRoot) {
			closeModal()
		}

		// Create container element
		modalContainer = document.createElement("div")
		modalContainer.id = "record-system-audio-tip-modal-container"
		modalContainer.style.position = "relative"
		modalContainer.style.zIndex = "1000"
		document.body.appendChild(modalContainer)

		// Create React root
		modalRoot = createRoot(modalContainer)

		const _handleClose = () => {
			closeModal()
			resolve()
		}

		const _handleDontShowAgain = () => {
			saveDontShowAgainPreference()
			closeModal()
			resolve()
		}

		// Render modal component
		const ModalComponent = () => {
			const [open, setOpen] = useState(true)

			const handleClose = () => {
				setOpen(false)
				setTimeout(() => {
					_handleClose()
				}, 200)
			}

			const handleDontShowAgain = () => {
				setOpen(false)
				setTimeout(() => {
					_handleDontShowAgain()
				}, 200)
			}

			return (
				<Suspense fallback={null}>
					<RecordSystemAudioTip
						open={open}
						onClose={handleClose}
						onDontShowAgain={handleDontShowAgain}
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

	if (modalContainer) {
		document.body.removeChild(modalContainer)
		modalContainer = null
	}
}
