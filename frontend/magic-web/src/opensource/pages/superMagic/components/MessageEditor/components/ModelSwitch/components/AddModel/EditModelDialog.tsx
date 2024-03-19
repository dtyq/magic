import { useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Spinner } from "@/opensource/components/shadcn-ui/spinner"
import { useAddModelStore } from "./context"
import ModelFormBody from "./ModelFormBody"
import AddModelConnectivityTest from "./AddModelConnectivityTest"

function EditModelDialog() {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [submitted, setSubmitted] = useState(false)
	const [isTestingConnectivity, setIsTestingConnectivity] = useState(false)

	useEffect(() => {
		if (store.isEditModelOpen) {
			store.loadOrgAiModelProviders(store.category)
			store.loadEditModelDetail()
		}
	}, [store.isEditModelOpen, store.category, store])

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			store.closeEditModel()
			setSubmitted(false)
		}
	}

	const handleConfirm = async () => {
		setSubmitted(true)
		if (!store.isAddModelFormValid) return
		const saved = await store.submitUpdateAiModel()
		if (saved?.id) {
			store.loadMyModels()
		}
		setSubmitted(false)
	}

	return (
		<Dialog open={store.isEditModelOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-fit !max-w-[unset] gap-0 overflow-visible p-0"
				data-testid="edit-model-dialog"
			>
				<DialogHeader className="border-b border-border p-3">
					<DialogTitle className="text-base font-semibold leading-6">
						{t("messageEditor.addModel.editModel")}
					</DialogTitle>
				</DialogHeader>

				{store.isLoadingEditModelDetail ? (
					<div
						className="grid min-h-[200px] grid-cols-[1fr_320px] items-center justify-items-center gap-x-2 gap-y-2.5 p-4"
						data-testid="edit-model-loading"
					>
						<Spinner size={24} className="col-span-2 animate-spin" />
					</div>
				) : (
					<ModelFormBody submitted={submitted} />
				)}

				<DialogFooter className="border-t border-border p-3 sm:justify-between">
					<AddModelConnectivityTest
						onBeforeTest={() => setSubmitted(true)}
						onLoadingChange={setIsTestingConnectivity}
					/>
					<div className="flex items-center gap-1.5">
						<Button
							variant="outline"
							onClick={() => store.closeEditModel()}
							disabled={store.isSubmitting || isTestingConnectivity}
							data-testid="edit-model-cancel-button"
						>
							{t("messageEditor.addModel.cancel")}
						</Button>
						<Button
							onClick={handleConfirm}
							disabled={store.isSubmitting || isTestingConnectivity}
							data-testid="edit-model-confirm-button"
						>
							{store.isSubmitting ? (
								<>
									<Spinner size={16} className="animate-spin" />
									{t("messageEditor.addModel.confirm")}
								</>
							) : (
								t("messageEditor.addModel.confirm")
							)}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default observer(EditModelDialog)
