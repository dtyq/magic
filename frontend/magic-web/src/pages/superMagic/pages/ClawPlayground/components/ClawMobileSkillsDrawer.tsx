import MagicPopup from "@/components/base-mobile/MagicPopup"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ClawSkillsPanel, type ClawSkillsPanelProps } from "./ClawSkillsPanel"

interface ClawMobileSkillsDrawerProps {
	open: boolean
	onClose: () => void
	/** Subtitle under the popup title, typically the current claw display name. */
	headerSubtitle?: string
	overrideInstall?: ClawSkillsPanelProps["overrideInstall"]
}

/**
 * Mobile skills install drawer: reuses file-preview actionHeader chrome
 * (drag handle, centered title/subtitle, floating close button on the left).
 */
export function ClawMobileSkillsDrawer({
	open,
	onClose,
	headerSubtitle,
	overrideInstall,
}: ClawMobileSkillsDrawerProps) {
	const { t } = useTranslation(["crew/create", "super"])
	const popupTitle = t("skills.title", { ns: "crew/create" })

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			position="bottom"
			title={popupTitle}
			headerVariant="actionHeader"
			headerTitle={popupTitle}
			headerSubtitle={headerSubtitle}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("common.close", { ns: "super" }),
				onClick: onClose,
				testId: "claw-mobile-skills-drawer-close-button",
			}}
			className="h-[85vh] max-h-[calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] rounded-t-[24px] border-0 bg-mobile-background"
			bodyClassName="flex h-full min-h-0 flex-col overflow-hidden"
			destroyOnClose={false}
		>
			<div
				className="flex h-full min-h-0 flex-col overflow-hidden bg-mobile-background"
				data-testid="claw-mobile-skills-drawer-content"
			>
				<ClawSkillsPanel
					onClose={onClose}
					hideShellTopBorder
					hideShellHeader
					closeAfterInstall
					overrideInstall={overrideInstall}
					showSkillCreateButton={false}
				/>
			</div>
		</MagicPopup>
	)
}
