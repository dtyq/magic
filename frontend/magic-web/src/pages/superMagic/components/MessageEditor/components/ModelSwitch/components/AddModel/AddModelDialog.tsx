import { useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { useAddModelStore } from "./context"
import AddProviderDialog from "./AddProviderDialog"
import EditProviderDialog from "./EditProviderDialog"
import ModelFormBody from "./ModelFormBody"
import EditModelDialog from "./EditModelDialog"
import ConfigBanner from "./ConfigBanner"
import AddModelConnectivityTest from "./AddModelConnectivityTest"
import type { SavedAiModel } from "./types"
import type { AddModelType } from "./store"

interface AddModelDialogProps {
	onModelSaved?: (model: SavedAiModel, modelType: AddModelType) => void
}

function AddModelDialog({ onModelSaved }: AddModelDialogProps) {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [submitted, setSubmitted] = useState(false)
	const [isTestingConnectivity, setIsTestingConnectivity] = useState(false)

	useEffect(() => {
		if (store.isAddModelOpen) {
			store.loadOrgAiModelProviders(store.category)
		}
	}, [store.isAddModelOpen, store.category, store])

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			store.closeAddModel()
			setSubmitted(false)
		}
	}

	const handleConfirm = async () => {
		setSubmitted(true)
		if (!store.isAddModelFormValid) return
		const addModelType = store.addModelType
		const saved = await store.submitSaveAiModel()
		if (saved?.id) {
			await store.loadMyModels()
			const newModel = store.myModels.find(
				(m) =>
					m.id === saved.id ||
					m.model_version === saved.model_version ||
					m.model_id === saved.model_id,
			)
			if (newModel) onModelSaved?.(newModel, addModelType)
		}
		setSubmitted(false)
	}

	return (
		<>
			<Dialog open={store.isAddModelOpen} onOpenChange={handleOpenChange}>
				<DialogContent
					className="w-fit !max-w-[unset] gap-0 overflow-visible p-0"
					data-testid="add-model-dialog"
				>
					<DialogHeader className="border-b border-border p-3">
						<DialogTitle className="text-base font-semibold leading-6">
							{t("messageEditor.addModel.addModel")}
						</DialogTitle>
					</DialogHeader>

					<ConfigBanner />

					<ModelFormBody submitted={submitted} />

					<DialogFooter className="border-t border-border p-3 sm:justify-between">
						<AddModelConnectivityTest
							onBeforeTest={() => setSubmitted(true)}
							onLoadingChange={setIsTestingConnectivity}
						/>
						<div className="flex items-center gap-1.5">
							<Button
								variant="outline"
								onClick={() => store.closeAddModel()}
								disabled={store.isSubmitting || isTestingConnectivity}
								data-testid="add-model-cancel-button"
							>
								{t("messageEditor.addModel.cancel")}
							</Button>
							<Button
								onClick={handleConfirm}
								disabled={store.isSubmitting || isTestingConnectivity}
								data-testid="add-model-confirm-button"
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

			<AddProviderDialog />
			<EditProviderDialog />
			<EditModelDialog />
		</>
	)
}

export default observer(AddModelDialog)
