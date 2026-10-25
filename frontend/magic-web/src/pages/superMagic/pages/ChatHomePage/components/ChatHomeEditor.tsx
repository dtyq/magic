import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import EditorLayout, {
	type EditorLayoutProps,
} from "../../../components/MainInputContainer/scenes/EditorLayout"
import { useChatHomeContext } from "../useChatHomeContext"
import { resolveDefaultAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"

/** Only the editor owns a fresh chat session; the surrounding home stays mounted. */
export default observer(function ChatHomeEditor(props: EditorLayoutProps) {
	const { t } = useTranslation("super/mainInput")
	const editorContext = useChatHomeContext()
	const defaultSelection = resolveDefaultAgentSelection()
	return (
		<EditorLayout
			{...props}
			mode={defaultSelection.topicPattern}
			editorContext={{
				...editorContext,
				topicMode: defaultSelection.topicPattern,
				agentCode: defaultSelection.agentCode,
				// Keep chat welcome copy independent of the default employee's task placeholder.
				placeholder: t("chatHome.placeholder"),
			}}
			inputContainerId={editorContext.sceneInputContainerId}
		/>
	)
})
