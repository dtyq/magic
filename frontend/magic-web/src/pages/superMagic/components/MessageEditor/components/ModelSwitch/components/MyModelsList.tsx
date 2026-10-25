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
} from "@/components/shadcn-ui/alert-dialog"
import type {
	ServiceProviderCategory,
	ServiceProviderModel,
} from "@/apis/modules/org-ai-model-provider"
import { useOptionalAddModelStore } from "./AddModel/context"
import type { ModelItem, ModelSelectionState } from "../types"
import { MyModelRow } from "./my-models-list/MyModelRow"
import { ModelSectionHeader } from "./ModelSectionHeader"
import { buildMyModelGroups } from "./my-models-list/utils"
import { userStore } from "@/models/user"
import { cn } from "@/utils/cn"

type MyModelsListKey = "models" | "image_models" | "video_models"

/** 分页与模型 category 的对应关系；model_type 不可靠，不用它归类。 */
const MODEL_CATEGORY_BY_KEY: Record<MyModelsListKey, ServiceProviderCategory> = {
	models: "llm",
	image_models: "vlm",
	video_models: "vgm",
}

/**
 * 当前分页要展示的「我的模型 / 企业模型」分组。列表本身和 ModelListContent
 * （判断平台模型是否需要分组标题）共用这一份过滤规则，两边结论不会不一致。
 */
export function getVisibleMyModelGroups(
	myModels: ServiceProviderModel[],
	modelKey: MyModelsListKey,
) {
	const targetCategory = MODEL_CATEGORY_BY_KEY[modelKey]
	return buildMyModelGroups({
		models: myModels.filter((model) => model.category === targetCategory),
	})
}

interface MyModelsListProps {
	allowModelManagement?: boolean
	modelKey?: MyModelsListKey
	selectedModel?: ModelItem | null
	onModelClick?: (model: ModelItem) => void
	selectedItemRef?: React.RefObject<HTMLDivElement>
	onModelsLoaded?: () => Promise<void> | void
	/** 桌面紧凑布局：分组标题与模型行对齐供应商分组；移动端弹层保持原布局。 */
	compact?: boolean
	getModelState?: (model: ModelItem) => ModelSelectionState | undefined
}

function MyModelsListInner({
	modelKey = "models",
	selectedModel,
	onModelClick,
	selectedItemRef,
	onModelsLoaded,
	compact = false,
	getModelState,
	allowModelManagement = true,
}: MyModelsListProps) {
	const { t } = useTranslation("super")
	const store = useOptionalAddModelStore()
	const { isPersonalOrganization } = userStore.user

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

	if (!store) return null

	const groupedModels = getVisibleMyModelGroups(store.myModels, modelKey)

	if (groupedModels.length === 0) return null

	return (
		<>
			<div
				className="flex flex-col gap-1 last:border-b-0 last:pb-0"
				data-testid="my-models-list"
			>
				<ModelSectionHeader
					title={
						isPersonalOrganization
							? t("messageEditor.addModel.myModels")
							: t("messageEditor.addModel.teamModels")
					}
					testId="my-models-list-header"
				/>
				<div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
					{groupedModels.map((group) => (
						<MyModelRow
							key={group.representativeModel.model_id}
							group={group}
							allowModelManagement={allowModelManagement}
							isSelected={
								selectedModel?.model_id === group.representativeModel.model_id
							}
							onSelect={onModelClick}
							getModelState={getModelState}
							selectedItemRef={selectedItemRef}
							onEdit={store.openEditModel}
							onDelete={store.openDeleteModel}
							compact={compact}
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
