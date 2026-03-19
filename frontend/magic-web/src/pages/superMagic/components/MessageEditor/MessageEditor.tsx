import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import { IconMessageCirclePlus } from "@tabler/icons-react"
import { Button } from "@/components/shadcn-ui/button"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { EDITOR_ICON_SIZE_MAP } from "./constants/constant"
import type { MessageEditorProps } from "./types"
import type { TopicMode } from "../../pages/Workspace/types"
import { MessageEditorContainer, type MessageEditorRef } from "./MessageEditorContainer"

export { MessageEditorContainer as MessageEditor }
export type { MessageEditorRef }

const MessageEditorWithTopicModeInvalidFallback = forwardRef<MessageEditorRef, MessageEditorProps>(
	(props, ref) => {
		const { t } = useTranslation("super")

		if (
			props.selectedTopic &&
			!superMagicModeService.isModeValid(props.topicMode as TopicMode)
		) {
			return (
				<div className="flex h-full min-h-[122px] flex-col items-center justify-center gap-2.5">
					<div className="text-xs leading-4 text-muted-foreground">
						{t("messageEditor.modeNotAvailableMessage")}
					</div>
					<Button variant="outline" size="sm" onClick={() => props.onCreateTopic?.()}>
						<IconMessageCirclePlus size={EDITOR_ICON_SIZE_MAP.default} />
						{t("messageEditor.newTopicButton")}
					</Button>
				</div>
			)
		}

		return <MessageEditorContainer {...props} ref={ref} />
	},
)

export default MessageEditorWithTopicModeInvalidFallback
