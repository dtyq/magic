import { useEffect } from "react"
import type React from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/opensource/components/shadcn-ui/alert-dialog"
import { MODEL_TYPE_IMAGE, MODEL_TYPE_LLM } from "@/opensource/apis/modules/org-ai-model-provider"
import { useOptionalAddModelStore } from "./AddModel/context"
import type { ModelItem } from "../types"
import MyModelsIcon from "../assets/my-models-icon.svg"
import { MyModelRow } from "./my-models-list/MyModelRow"
import { buildMyModelGroups } from "./my-models-list/utils"

const MODEL_TYPE_BY_KEY: Record<"models" | "image_models", number> = {
	models: MODEL_TYPE_LLM,
	image_models: MODEL_TYPE_IMAGE,
}

interface MyModelsListProps {
	modelKey?: "models" | "image_models"
	selectedModel?: ModelItem | null
	onModelClick?: (model: ModelItem) => void
	selectedItemRef?: React.RefObject<HTMLDivElement>
	onModelsLoaded?: () => Promise<void> | void
}

function MyModelsListInner({
	modelKey = "models",
	selectedModel,
	onModelClick,
	selectedItemRef,
	onModelsLoaded,
}: MyModelsListProps) {
	const { t } = useTranslation("super")
	const store = useOptionalAddModelStore()

	useEffect(() => {
		if (!store) return

		let isMounted = true

		const loadModels = async () => {
			await store.loadMyModels()
			if (!isMounted) return
			await onModelsLoaded?.()
		}

		void loadModels()

		return () => {
			isMounted = false
		}
	}, [store, onModelsLoaded])

	useEffect(() => {
		if (!store) return
		void store.loadServiceProvidersForModelKey(modelKey)
	}, [store, modelKey])

	useEffect(() => {
		if (!store) return
		void store.loadProviderTemplatesForModelKey(modelKey)
	}, [store, modelKey])

	if (!store) return null

	const targetModelType = MODEL_TYPE_BY_KEY[modelKey]
	const visibleModels = store.myModels.filter((model) => model.model_type === targetModelType)
	const groupedModels = buildMyModelGroups({
		models: visibleModels,
		providers: store.getServiceProvidersByModelKey(modelKey),
		providerTemplates: store.getProviderTemplatesByModelKey(modelKey),
	})

	if (groupedModels.length === 0) return null

	return (
		<>
			<div className="last:border-b-0 last:pb-0" data-testid="my-models-list">
				<div className="flex items-center gap-1 pb-1">
					<img src={MyModelsIcon} alt="" className="size-4" />
					<span className="text-xs text-foreground">
						{t("messageEditor.addModel.myModels")}
					</span>
				</div>
				<div className="flex flex-col gap-1">
					{groupedModels.map((group) => (
						<MyModelRow
							key={group.representativeModel.model_id}
							group={group}
							isSelected={
								selectedModel?.model_id === group.representativeModel.model_id
							}
							onSelect={onModelClick}
							selectedItemRef={selectedItemRef}
							onEdit={store.openEditModel}
							onDelete={store.openDeleteModel}
						/>
					))}
				</div>
			</div>

			<AlertDialog
				open={!!store.deletingModelId}
				onOpenChange={(open) => {
					if (!open) store.closeDeleteModel()
				}}
			>
				<AlertDialogContent data-testid="delete-model-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("messageEditor.addModel.deleteModelTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("messageEditor.addModel.deleteModelDesc")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel data-testid="delete-model-cancel">
							{t("messageEditor.addModel.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() =>
								store.deletingModelId &&
								store.confirmDeleteModel({ onSuccess: onModelsLoaded })
							}
							data-testid="delete-model-confirm"
						>
							{t("messageEditor.addModel.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export const MyModelsList = observer(MyModelsListInner)
