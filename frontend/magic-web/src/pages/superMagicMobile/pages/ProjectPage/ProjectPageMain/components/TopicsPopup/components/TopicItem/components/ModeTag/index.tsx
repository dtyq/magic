import { memo, useMemo } from "react"
import { computed } from "mobx"
import { useTranslation } from "react-i18next"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import IconComponent from "@/pages/superMagic/components/IconViewComponent"
import MagicIcon from "@/components/base/MagicIcon"
import { IconMessageCircleQuestion } from "@tabler/icons-react"
import type { ModeTagProps } from "./types"

function ModeTag({ mode = TopicMode.General }: ModeTagProps) {
	const { t } = useTranslation("super")

	const config = useMemo(() => {
		return computed(() => {
			return superMagicModeService.getModeConfigWithLegacy(mode, t)
		}).get()
	}, [mode, t])

	if (!config) {
		return (
			<div className="flex size-5 shrink-0 items-center justify-center rounded">
				<MagicIcon component={IconMessageCircleQuestion} size={16} />
			</div>
		)
	}

	return (
		<div className="flex size-5 shrink-0 items-center justify-center rounded">
			<IconComponent
				iconType={config.mode.icon_type}
				iconUrl={config.mode.icon_url}
				selectedIcon={config.mode.icon}
				size={16}
				iconColor={config.mode.color}
				showBorder={true}
			/>
		</div>
	)
}

export default memo(ModeTag)
