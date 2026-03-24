import MagicPopup from "@/components/base-mobile/MagicPopup"
import { useTranslation } from "react-i18next"
import { ClawSkillsPanel } from "./ClawSkillsPanel"

interface ClawMobileSkillsDrawerProps {
	open: boolean
	onClose: () => void
}

export function ClawMobileSkillsDrawer({ open, onClose }: ClawMobileSkillsDrawerProps) {
	const { t } = useTranslation("sidebar")

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			title={t("skillsLibrary.title")}
			position="bottom"
			className="h-[85vh] max-h-[calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))]"
			bodyClassName="flex h-full flex-col overflow-hidden"
			destroyOnClose={false}
		>
			<div
				className="min-h-0 flex-1 overflow-hidden"
				data-testid="claw-mobile-skills-drawer-content"
			>
				<ClawSkillsPanel
					onClose={onClose}
					hideShellTopBorder
					showSkillCreateButton={false}
				/>
			</div>
		</MagicPopup>
	)
}
