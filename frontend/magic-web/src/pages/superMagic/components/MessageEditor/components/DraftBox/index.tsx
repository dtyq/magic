import React, { useEffect, useState } from "react"
import { IconX, IconClock, IconTrash, IconInbox } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import type { DraftData } from "../../types"
import MagicModal from "@/components/base/MagicModal"
import { useDeepCompareEffect } from "ahooks"
import { formatTime } from "@/utils/string"
import RichText from "../../../MessageList/components/Text/components/RichText"
import MentionList from "../MentionList"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Tooltip } from "antd"
import { observer } from "mobx-react-lite"
import {
	draftBoxTriggerVariants,
	draftBoxContainerVariants,
	draftBoxHeaderVariants,
	draftBoxHeaderLeftVariants,
	draftBoxIconContainerVariants,
	draftBoxTitleSectionVariants,
	draftBoxTitleVariants,
	draftBoxSubtitleVariants,
	draftBoxCloseButtonVariants,
	draftBoxContentVariants,
	draftBoxScrollContainerVariants,
	draftBoxScrollContentVariants,
	draftBoxEmptyStateVariants,
	draftBoxItemVariants,
	draftBoxItemContentVariants,
	draftBoxItemFooterVariants,
	draftBoxTimeInfoVariants,
	draftBoxActionsVariants,
	draftBoxActionButtonVariants,
	draftBoxTipVariants,
	draftBoxModalBodyVariants,
} from "./variants"
import type { DraftStore } from "../../stores"
import { cn } from "@/lib/utils"

interface DraftBoxProps {
	draftStore: DraftStore
	topicName?: string
	iconSize?: number
	className?: string
}
function DraftBoxComponent({
	draftStore,
	topicName = "",
	iconSize = 20,
	className,
}: DraftBoxProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	const [visible, setVisible] = useState(false)
	const drafts = draftStore.drafts
	const loading = draftStore.isDraftsLoading
	const draftKey = draftStore.draftKey

	useDeepCompareEffect(() => {
		if (!draftKey) return
		draftStore.loadDraftVersions()
	}, [draftKey, visible, draftStore])

	const handleDeleteDraft = async (draft: DraftData) => {
		const deleteModal = MagicModal.confirm({
			title: t("draftBox.deleteConfirm.title"),
			content: t("draftBox.deleteConfirm.content"),
			variant: "destructive",
			showIcon: true,
			okText: t("draftBox.deleteConfirm.okText"),
			cancelText: t("draftBox.deleteConfirm.cancelText"),
			centered: true,
			onOk: async () => {
				try {
					await draftStore.deleteDraftVersion(draft)
				} finally {
					deleteModal.destroy()
				}
			},
			onCancel: () => {
				deleteModal.destroy()
			},
		})
	}

	const handleUseDraft = (draft: DraftData) => {
		draftStore.useDraft(draft)
		setVisible(false)
	}

	useEffect(() => {
		if (drafts.length === 0 && visible) {
			setVisible(false)
		}
	}, [drafts.length, visible])

	if (drafts.length === 0) {
		return null
	}

	const size = isMobile ? "mobile" : "default"

	const content = (
		<div className={draftBoxContainerVariants()}>
			{/* Header */}
			<div className={draftBoxHeaderVariants({ size })}>
				<div className={draftBoxHeaderLeftVariants()}>
					<div className={draftBoxIconContainerVariants({ size })}>
						<IconInbox size={isMobile ? 20 : 24} color="white" />
					</div>
					<div className={draftBoxTitleSectionVariants()}>
						<div className={draftBoxTitleVariants()}>{t("draftBox.title")}</div>
						{topicName && (
							<div className={draftBoxSubtitleVariants()}># {topicName}</div>
						)}
					</div>
				</div>
				<button
					type="button"
					className={draftBoxCloseButtonVariants({ size })}
					onClick={() => setVisible(false)}
				>
					<IconX size={isMobile ? 20 : 24} />
				</button>
			</div>

			{/* Content */}
			<div className={draftBoxContentVariants()}>
				<div className={draftBoxScrollContainerVariants({ size })}>
					<div className={draftBoxScrollContentVariants()}>
						{loading ? (
							<div className={draftBoxEmptyStateVariants()}>
								{t("draftBox.loading")}
							</div>
						) : drafts.length === 0 ? (
							<div className={draftBoxEmptyStateVariants()}>
								{t("draftBox.noDrafts")}
							</div>
						) : (
							drafts.map((draft, index) => (
								<div
									key={`${draft.updatedAt}-${index}`}
									className={draftBoxItemVariants()}
								>
									<div className={draftBoxItemContentVariants()}>
										{draft.mentionItems.length > 0 && (
											<MentionList
												mentionItems={draft.mentionItems}
												markerClickScene="draftBox"
											/>
										)}
										<RichText
											content={draft.value}
											markerClickScene="draftBox"
										/>
									</div>
									<div className={draftBoxItemFooterVariants()}>
										<div className={draftBoxTimeInfoVariants()}>
											<IconClock size={14} />
											<span>
												{formatTime(
													draft.updatedAt / 1000,
													"YYYY/MM/DD HH:mm:ss",
												)}
											</span>
										</div>
										<div className={draftBoxActionsVariants()}>
											<button
												type="button"
												className={draftBoxActionButtonVariants({
													variant: "delete",
												})}
												onClick={() => handleDeleteDraft(draft)}
											>
												<IconTrash size={14} />
												{t("draftBox.deleteDraft")}
											</button>
											<button
												type="button"
												className={draftBoxActionButtonVariants({
													variant: "use",
												})}
												onClick={() => handleUseDraft(draft)}
											>
												{t("draftBox.useDraft")}
											</button>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>
				<div className={draftBoxTipVariants({ size })}>{t("draftBox.retentionTip")}</div>
			</div>
		</div>
	)

	return (
		<>
			<button
				type="button"
				className={cn(draftBoxTriggerVariants({ size }), className)}
				onClick={() => setVisible(true)}
				data-testid="draft-box-trigger"
				data-count={drafts.length}
				data-visible={visible}
			>
				{isMobile ? (
					<IconInbox size={iconSize} />
				) : (
					<Tooltip title={t("draftBox.trigger")}>
						<IconInbox size={iconSize} />
					</Tooltip>
				)}
			</button>
			{isMobile ? (
				<MagicPopup visible={visible} onClose={() => setVisible(false)}>
					{content}
				</MagicPopup>
			) : (
				<MagicModal
					open={visible}
					onCancel={() => setVisible(false)}
					footer={null}
					closeIcon={null}
					classNames={{
						body: draftBoxModalBodyVariants(),
					}}
				>
					{content}
				</MagicModal>
			)}
		</>
	)
}

export const DraftBox = observer(DraftBoxComponent)
