import { useState } from "react"
import { ChevronsUpDown, MessageCirclePlus } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"
import { isString } from "lodash-es"
import { cn } from "@/lib/utils"
import { MagicIcon } from "@/components/base"
import BlackPurpleButton from "@/components/other/BlackPurpleButton"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import CrewSelectModal from "../CrewSelectModal"
import { useMemoizedFn } from "ahooks"
import { CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { observer } from "mobx-react-lite"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { useFeaturedModeListRefreshOnFirstOpen } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

function modeMatchesTopic(
	modeIdentifier: string,
	topicMode: TopicMode | undefined,
	agentCode?: string | null,
) {
	if (topicMode === TopicMode.CustomAgent && agentCode) return modeIdentifier === agentCode
	return modeIdentifier === topicMode
}

interface ModeSelectorProps {
	className?: string
	showBorder?: boolean
	iconSize?: number
	/** 与桌面 ModeToggle 一致的数据源；不传时回退为 roleStore（兼容旧用法） */
	editorContext?: SceneEditorContext
}

const TopicPlusIcon = <MagicIcon component={MessageCirclePlus} size={18} color="currentColor" />

export default observer(function ModeSelector({
	className,
	showBorder = false,
	iconSize = 16,
	editorContext,
}: ModeSelectorProps) {
	const { t } = useTranslation("super")

	const topicMode = editorContext?.topicMode ?? roleStore.currentRole
	const agentCode = editorContext?.agentCode ?? editorContext?.selectedTopic?.agent_code
	const allowChangeMode = editorContext
		? (editorContext.messagesLength ?? 0) > 0
			? false
			: true
		: true

	const applyTopicMode = useMemoizedFn((mode: TopicMode) => {
		if (editorContext?.setTopicMode) {
			editorContext.setTopicMode(mode)
			return
		}
		roleStore.setCurrentRole(mode)
	})

	const selectedModeIdentifier =
		topicMode === TopicMode.CustomAgent && agentCode ? agentCode : (topicMode ?? "")

	const selectedCrew = topicMode
		? superMagicModeService.getModeConfigWithLegacy(topicMode, t, false, agentCode)
		: null

	const [crewSelectOpen, setCrewSelectOpen] = useState(false)
	const [showNewTopicModal, setShowNewTopicModal] = useState<{
		visible: boolean
		mode: CrewItem["mode"] | null
	}>({ visible: false, mode: null })

	useFeaturedModeListRefreshOnFirstOpen(crewSelectOpen)

	const resolveModeText = useMemoizedFn((text?: string, fallback?: string) => {
		return text || fallback
	})

	const handleCreateNewTopic = useMemoizedFn(() => {
		const targetMode = showNewTopicModal.mode?.identifier as TopicMode
		setShowNewTopicModal({ visible: false, mode: null })
		setTimeout(() => {
			document.body.style.removeProperty("pointer-events")
			pubsub.publish(PubSubEvents.Create_New_Topic)
			applyTopicMode(targetMode)
		}, 0)
	})

	const handleCrewSelect = useMemoizedFn((crew: CrewItem) => {
		if (allowChangeMode) {
			applyTopicMode(crew.mode.identifier as TopicMode)
			setCrewSelectOpen(false)
			return
		}

		if (modeMatchesTopic(crew.mode.identifier, topicMode, agentCode)) {
			setCrewSelectOpen(false)
			return
		}

		setCrewSelectOpen(false)
		setShowNewTopicModal({ visible: true, mode: crew.mode })
	})

	const handleClick = useMemoizedFn(() => {
		setCrewSelectOpen(true)
	})

	if (!topicMode && !isString(topicMode)) {
		return null
	}

	return (
		<>
			<div
				className={cn(
					"flex h-10 shrink-0 items-center",
					showBorder
						? "gap-1 rounded-full border-2 border-foreground bg-background px-1 py-1 shadow-sm"
						: "gap-1 pl-1.5 pr-2.5",
					className,
				)}
				data-testid="mobile-mode-selector-trigger"
				onClick={handleClick}
			>
				{selectedCrew && (
					<ModeAvatar
						mode={selectedCrew.mode}
						iconSize={iconSize}
						data-testid="mobile-mode-selector-avatar"
					/>
				)}
				<ChevronsUpDown size={16} className="text-foreground" />
			</div>

			<CrewSelectModal
				visible={crewSelectOpen}
				modes={superMagicModeService.modeList}
				selectedCrew={selectedModeIdentifier}
				onClose={() => setCrewSelectOpen(false)}
				onSelectCrew={handleCrewSelect}
			/>

			{!allowChangeMode ? (
				<MagicPopup
					visible={showNewTopicModal.visible}
					onClose={() => setShowNewTopicModal({ visible: false, mode: null })}
					position="bottom"
					className="z-popup"
					title={t("modeToggle.selectCrew")}
				>
					<div
						className="flex flex-col gap-4 p-4"
						data-testid="mobile-mode-selector-create-topic-dialog"
					>
						<div className="flex w-full flex-col gap-3 rounded-lg">
							<div className="text-xs leading-[18px] text-foreground">
								<Trans
									i18nKey="modeToggle.cannotSwitchModeMessage"
									ns="super"
									values={{
										modeName: resolveModeText(showNewTopicModal.mode?.name),
									}}
									components={{ strong: <strong /> }}
								/>
							</div>
							<BlackPurpleButton
								onClick={handleCreateNewTopic}
								icon={TopicPlusIcon}
								data-testid="mobile-mode-selector-create-topic-button"
							>
								<span className="text-xs font-normal leading-4">
									{t("modeToggle.createNewTopic")}
								</span>
							</BlackPurpleButton>
						</div>
					</div>
				</MagicPopup>
			) : null}
		</>
	)
})
