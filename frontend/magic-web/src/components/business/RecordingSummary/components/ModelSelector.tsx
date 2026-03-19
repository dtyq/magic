import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import recordSummaryStore from "@/stores/recordingSummary"
import { observer } from "mobx-react-lite"
import { createStyles } from "antd-style"
import LanguageModelSwitch from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/LanguageModelSwitch"

const useStyles = createStyles(({ css }) => ({
	modelSelector: css`
		max-width: 75%;
		flex: inherit;
	`,
}))

const ModelSelector = observer(() => {
	const { styles } = useStyles()
	const recordSummaryService = initializeService()
	const modelGroups = superMagicModeService.getModelGroupsByMode(TopicMode.RecordSummary) ?? []

	const selectedModel = recordSummaryStore.businessData.model

	return (
		<LanguageModelSwitch
			size="small"
			selectedModel={selectedModel}
			modelList={modelGroups}
			isLoading={false}
			onModelChange={recordSummaryService.updateModel}
			showName
			showBorder
			placement="bottom"
			className={styles.modelSelector}
		/>
	)
})

export default ModelSelector
