import { useMemo, useCallback, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import ModelSwitch from "./index"
import useTopicModel from "../../hooks/useTopicModel"
import { useMessageEditorStore } from "../../stores"
import type { ModelSwitchProps } from "./types"
import { ModelStatusEnum } from "./types"
import type {
	ProjectListItem,
	Topic,
	TopicMode,
} from "@/pages/superMagic/pages/Workspace/types"
import { useOptionalScenePanelVariant } from "../../../MainInputContainer/stores/context"
import { ScenePanelVariant } from "../../../MainInputContainer/components/LazyScenePanel/types"
import { AddModelStore } from "./components/AddModel/store"
import type { AddModelType } from "./components/AddModel/store"
import { AddModelStoreProvider } from "./components/AddModel/context"
import AddModelDialog from "./components/AddModel/AddModelDialog"
import type { SavedAiModel } from "./components/AddModel/types"
import ModelConnectGuide from "./components/ModelConnectGuide"
import { useIsMobile } from "@/hooks/useIsMobile"

export interface ModelSwitchContainerProps extends Omit<
	ModelSwitchProps,
	| "modelList"
	| "imageModelList"
	| "selectedModel"
	| "selectedImageModel"
	| "onModelChange"
	| "onImageModelChange"
	| "isLoading"
> {
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	topicMode?: TopicMode
}

function ModelSwitchContainer({
	selectedTopic,
	selectedProject,
	topicMode,
	...props
}: ModelSwitchContainerProps) {
	const store = useMessageEditorStore()
	const addModelStore = useMemo(() => new AddModelStore(), [])
	const [openAddModelMenuSignal, setOpenAddModelMenuSignal] = useState(0)
	const guideAnchorRef = useRef<HTMLDivElement>(null)
	const isMobile = useIsMobile()

	const variant = useOptionalScenePanelVariant()

	const {
		topicModelStore,
		modelList,
		imageModelList,
		validateSelectedModels,
		setSelectedModel,
		setSelectedImageModel,
	} = useTopicModel({
		selectedTopic,
		selectedProject,
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

	return (
		<AddModelStoreProvider value={addModelStore}>
			<div ref={guideAnchorRef} className="relative inline-flex">
				<ModelSwitch
					{...props}
					showLabel={
						variant &&
							[ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant)
							? false
							: true
					}
					modelList={modelList}
					imageModelList={imageModelList}
					selectedModel={topicModelStore.selectedLanguageModel}
					selectedImageModel={topicModelStore.selectedImageModel}
					isLoading={topicModelStore.isLoading}
					onModelChange={setSelectedModel}
					onBeforeOpen={validateSelectedModels}
					onImageModelChange={setSelectedImageModel}
					openAddModelMenuSignal={openAddModelMenuSignal}
					editable={variant !== ScenePanelVariant.Mobile}
					onAddModel={(modelType) => addModelStore.openAddModel(modelType)}
				/>
				<ModelConnectGuide
					anchorRef={guideAnchorRef}
					enabled={!isMobile}
					onConnect={handleConnectGuide}
				/>
			</div>
			<AddModelDialog onModelSaved={handleModelSaved} />
		</AddModelStoreProvider>
	)
}

export default observer(ModelSwitchContainer)
