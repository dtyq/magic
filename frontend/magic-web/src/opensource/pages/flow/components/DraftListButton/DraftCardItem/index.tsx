import type { FlowDraft } from "@/opensource/types/flow"
import { IconEdit, IconTrashX } from "@tabler/icons-react"
import { Flex, Popconfirm, Tooltip } from "antd"
import EmptyIcon from "@/opensource/assets/logos/empty.svg"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useMemo, type MutableRefObject } from "react"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import { cx } from "antd-style"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import styles from "./index.module.less"
import SaveDraftButton from "../../SaveDraftButton"

type DraftCardItemProps = {
	draft: FlowDraft.ListItem
	onDeleteItem: (draftId: string) => void
	flow?: MagicFlow.Flow
	flowInstance?: MutableRefObject<MagicFlowInstance | null>
	onSwitchDraft: (draft: FlowDraft.ListItem) => void
	initDraftList?: (this: any, flowCode: any) => Promise<FlowDraft.Detail[]>
}

export default function DraftCardItem({
	draft,
	onDeleteItem,
	flow,
	flowInstance,
	onSwitchDraft,
	initDraftList,
}: DraftCardItemProps) {
	const { t } = useTranslation()

	const isActiveDraft = useMemo(() => {
		// @ts-ignore
		return flow?.draft_id === draft.id
		// @ts-ignore
	}, [draft.id, flow?.draft_id])

	return (
		<div
			className={cx(styles.draftCardItem, {
				[styles.active]: isActiveDraft,
			})}
			onClick={() => onSwitchDraft(draft)}
		>
			<Flex className={styles.header} justify="space-between">
				<Flex>
					<Tooltip title={draft.name}>
						<span className={styles.draftName}>
							{draft.name}
							{isActiveDraft ? `（${t("common.currentDraft", { ns: "flow" })}）` : ""}
						</span>
					</Tooltip>
				</Flex>
				<Flex gap={8} onClick={(e) => e.stopPropagation()}>
					<Tooltip title={t("common.updateDraft", { ns: "flow" })}>
						<SaveDraftButton
							draft={draft}
							flowInstance={flowInstance}
							flow={flow}
							Icon={(props: Record<string, any>) => {
								return (
									<div className={styles.iconWrap} {...props}>
										<IconEdit height={18} />
									</div>
								)
							}}
							initDraftList={initDraftList}
						/>
					</Tooltip>
					<Tooltip title={t("common.deleteDraft", { ns: "flow" })}>
						<Popconfirm
							title={t("common.confirmDelete", { ns: "flow" })}
							onConfirm={() => {
								onDeleteItem(draft.id)
							}}
						>
							<div className={styles.iconWrap} onClick={(e) => e.stopPropagation()}>
								<IconTrashX height={18} />
							</div>
						</Popconfirm>
					</Tooltip>
				</Flex>
			</Flex>
			<span className={styles.draftDesc}>{draft.description}</span>
			<Flex justify="space-between">
				<Flex justify="space-between" gap={4} align="center">
					<MagicAvatar
						size={20}
						shape="circle"
						src={draft?.modifier_info?.avatar || EmptyIcon}
					/>
					<span className={styles.name}>{draft?.modifier_info?.name || "未知用户"}</span>
				</Flex>
				<Flex>
					<span>
						{resolveToString(t("common.draftUpdateAt", { ns: "flow" }), {
							timeStr: draft.updated_at,
						})}
					</span>
				</Flex>
			</Flex>
		</div>
	)
}
