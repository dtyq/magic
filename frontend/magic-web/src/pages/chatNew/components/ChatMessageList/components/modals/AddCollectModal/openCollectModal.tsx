import { openModal } from "@/utils/react"
import type { AddCollectModalProps } from "."
import { AddCollectModal } from "."

const openCollectModal = (props: AddCollectModalProps) => {
	return openModal(AddCollectModal, props)
}

export default openCollectModal
