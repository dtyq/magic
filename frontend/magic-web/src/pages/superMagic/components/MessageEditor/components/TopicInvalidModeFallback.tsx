import { useTranslation } from "react-i18next"
import { IconMessageCirclePlus } from "@tabler/icons-react"
import { Button } from "@/components/shadcn-ui/button"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { EDITOR_ICON_SIZE_MAP } from "../constants/constant"

export interface InvalidModeFallbackProps {
	onCreateTopic?: () => void
}

export function TopicInvalidModeFallback({ onCreateTopic }: InvalidModeFallbackProps) {
	const { t } = useTranslation("super")
	const {
		options: { createNewTopic },
	} = useFileAccess()
	const shouldHideTopicEntry = !createNewTopic

	return (
		<div className="mx-2 flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl px-4 py-3">
			<div className="text-center text-xs leading-4 text-muted-foreground">
				{t("messageEditor.modeNotAvailableMessage")}
			</div>
			{!shouldHideTopicEntry ? (
				<Button variant="outline" size="sm" onClick={() => onCreateTopic?.()}>
					<IconMessageCirclePlus size={EDITOR_ICON_SIZE_MAP.default} />
					{t("messageEditor.newTopicButton")}
				</Button>
			) : null}
		</div>
	)
}
