import { Suspense, useCallback, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { userStore } from "@/models/user"
import ModelSwitch from "./index"
import useTopicModel from "../../hooks/useTopicModel"
import { useMessageEditorStore } from "../../stores"
import type { ModelSwitchProps } from "./types"
import { ModelStatusEnum } from "./types"
import type { ProjectListItem, Topic, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { useOptionalScenePanelVariant } from "../../../MainInputContainer/stores/context"
import { ScenePanelVariant } from "../../../MainInputContainer/components/LazyScenePanel/types"
import { AddModelDialogLazy } from "./components/AddModel/add-model-dialog-lazy"
import { AddModelStoreProvider } from "./components/AddModel/context"
import { AddModelStore } from "./components/AddModel/store"
import type { AddModelType } from "./components/AddModel/store"
import type { SavedAiModel } from "./components/AddModel/types"
import ModelConnectGuide from "./components/ModelConnectGuide"

export interface ModelSwitchContainerProps extends Omit<
	ModelSwitchProps,
	| "modelList"
	| "imageModelList"
	| "videoModelList"
	| "selectedModel"
	| "selectedImageModel"
	| "selectedVideoModel"
	| "onModelChange"
	| "onImageModelChange"
	| "onVideoModelChange"
	| "isLoading"
> {
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	agentCode?: string | null
	autoFetch?: boolean
	topicMode?: TopicMode
}

function ModelSwitchContainer({
	selectedTopic,
	selectedProject,
	agentCode,
	autoFetch,
	topicMode,
	showLabel,
	...props
}: ModelSwitchContainerProps) {
	const store = useMessageEditorStore()
	const { isPersonalOrganization } = userStore.user
	const [openAddModelMenuSignal, setOpenAddModelMenuSignal] = useState(0)
	const guideAnchorRef = useRef<HTMLDivElement>(null)
	const addModelStore = useMemo(() => new AddModelStore(), [])

	const variant = useOptionalScenePanelVariant()
	const canManageModels = isPersonalOrganization
	const resolvedShowLabel =
		showLabel ??
		!(variant && [ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant))

	const {
		topicModelStore,
		modelList,
		imageModelList,
		videoModelList,
		validateSelectedModels,
		setSelectedModel,
		setSelectedImageModel,
		setSelectedVideoModel,
	} = useTopicModel({
		selectedTopic,
		selectedProject,
		agentCode,
		autoFetch,
		topicMode,
		topicModelStore: store.topicModelStore,
	})

	const handleModelSaved = useCallback(
		(savedModel: SavedAiModel, modelType: AddModelType) => {
			const modelItem = {
				id: savedModel.id,
				group_id: "",
				model_id: savedModel.model_id,
				model_name: savedModel.name,
				provider_model_id: savedModel.model_version || savedModel.model_id,
				model_description: "",
				model_icon: savedModel.icon || "",
				model_status: ModelStatusEnum.Normal,
				sort: 0,
			}
			if (modelType === "image") {
				setSelectedImageModel(modelItem)
			} else {
				setSelectedModel(modelItem)
			}
		},
		[setSelectedModel, setSelectedImageModel],
	)

	const handleConnectGuide = useCallback(() => {
		setOpenAddModelMenuSignal((currentValue) => currentValue + 1)
	}, [])

	const handleAddModel = useCallback(
		(modelType: AddModelType) => {
			if (!canManageModels) return

			addModelStore.openAddModel(modelType)
		},
		[addModelStore, canManageModels],
	)

	return (
		<AddModelStoreProvider value={addModelStore}>
			<>
				<div ref={guideAnchorRef} className="relative inline-flex">
					<ModelSwitch
						{...props}
						showLabel={resolvedShowLabel}
						modelList={modelList}
						imageModelList={imageModelList}
						videoModelList={videoModelList}
						selectedModel={topicModelStore.selectedLanguageModel}
						selectedImageModel={topicModelStore.selectedImageModel}
						selectedVideoModel={topicModelStore.selectedVideoModel}
						isLoading={topicModelStore.isLoading}
						onModelChange={setSelectedModel}
						onBeforeOpen={validateSelectedModels}
						onImageModelChange={setSelectedImageModel}
						onVideoModelChange={setSelectedVideoModel}
						openAddModelMenuSignal={openAddModelMenuSignal}
						editable={variant !== ScenePanelVariant.Mobile}
						onAddModel={handleAddModel}
					/>
					<ModelConnectGuide
						anchorRef={guideAnchorRef}
						enabled={false}
						onConnect={handleConnectGuide}
					/>
				</div>
				{canManageModels ? (
					<Suspense fallback={null}>
						<AddModelDialogLazy onModelSaved={handleModelSaved} />
					</Suspense>
				) : null}
			</>
		</AddModelStoreProvider>
	)
}

export default observer(ModelSwitchContainer)
