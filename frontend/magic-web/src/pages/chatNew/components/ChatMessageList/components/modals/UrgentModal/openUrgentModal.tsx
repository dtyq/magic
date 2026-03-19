import { createRoot } from "react-dom/client"
import { DetachComponentProviders } from "@/components/other/DetachComponentProviders"
import UrgentModal from "./index"
import { BrowserProvider } from "@/providers/BrowserProvider"

const openUrgentModal = (msgId: string) => {
	const root = document.createElement("div")
	document.body.appendChild(root)

	const close = () => {
		setTimeout(() => {
			root.remove()
		})
	}

	createRoot(root).render(
		<BrowserProvider>
			<DetachComponentProviders>
				<UrgentModal msgId={msgId} onClose={close} />
			</DetachComponentProviders>
		</BrowserProvider>,
	)
}

export default openUrgentModal
