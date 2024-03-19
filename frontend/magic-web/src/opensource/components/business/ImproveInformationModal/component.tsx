import MagicModal from "@/opensource/components/base/MagicModal"
import { useEffect } from "react"
import type { ImproveInformationModalProps } from "./types"
import { ImproveInformationModalContainerId } from "./utils"
import { useImproveInformationForm } from "./hooks/useImproveInformationForm"
import ImproveInformationForm from "./components/ImproveInformationForm"

function ImproveInformationModal({
	open = false,
	onClose,
	onSubmit,
}: ImproveInformationModalProps) {
	const form = useImproveInformationForm({
		onSubmit,
		onSuccess: onClose,
	})

	useEffect(() => {
		if (!open) form.reset()
	}, [open, form])

	return (
		<MagicModal
			width={520}
			classNames={{
				content: "!rounded-[10px] overflow-hidden",
				body: "!p-0 w-full flex flex-col items-center bg-background !rounded-[10px] overflow-y-auto max-h-[90vh]",
			}}
			open={open}
			closable={false}
			footer={null}
			maskClosable={false}
			centered
			getContainer={
				document.getElementById(ImproveInformationModalContainerId) || document.body
			}
		>
			<ImproveInformationForm form={form} />
		</MagicModal>
	)
}

export default ImproveInformationModal
