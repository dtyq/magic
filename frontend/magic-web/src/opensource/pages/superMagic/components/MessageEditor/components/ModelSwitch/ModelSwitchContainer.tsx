import { useMemo, useCallback } from "react"
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
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useOptionalScenePanelVariant } from "../../../MainInputContainer/stores/context"
import { ScenePanelVariant } from "../../../MainInputContainer/components/LazyScenePanel/types"
import { AddModelStore } from "./components/AddModel/store"
import type { AddModelType } from "./components/AddModel/store"
import { AddModelStoreProvider } from "./components/AddModel/context"
import AddModelDialog from "./components/AddModel/AddModelDialog"
import type { SavedAiModel } from "./components/AddModel/types"

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

	return (
		<AddModelStoreProvider value={addModelStore}>
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
				editable={variant !== ScenePanelVariant.Mobile}
				onAddModel={(modelType) => addModelStore.openAddModel(modelType)}
			/>
			<AddModelDialog onModelSaved={handleModelSaved} />
		</AddModelStoreProvider>
	)
}

export default observer(ModelSwitchContainer)
