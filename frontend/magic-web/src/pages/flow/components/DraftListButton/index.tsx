import { Button, Drawer, Modal, Tooltip } from "antd"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useFlowStore } from "@/stores/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { IconHistory } from "@tabler/icons-react"
import EmptyIcon from "@/assets/logos/empty.svg"
import { cx } from "antd-style"
import { useMemo, type MutableRefObject } from "react"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import type { FlowDraft } from "@/types/flow"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { FlowApi } from "@/apis"
import styles from "./index.module.less"
import DraftCardItem from "./DraftCardItem"
import { useCustomFlow } from "../../context/CustomFlowContext/useCustomFlow"
import { hasEditRight } from "../AuthControlButton/types"
import { unShadowFlow } from "../../utils/helpers"
import magicToast from "@/components/base/MagicToaster/utils"

type DraftListButtonProps = {
	flow?: MagicFlow.Flow
	flowInstance?: MutableRefObject<MagicFlowInstance | null>
	initDraftList: (this: any, flowCode: any) => Promise<FlowDraft.Detail[]>
	showFlowIsDraftToast: () => void
}

export default function DraftListButton({
	flow,
	flowInstance,
	initDraftList,
	showFlowIsDraftToast,
}: DraftListButtonProps) {
	const { t } = useTranslation()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const { setCurrentFlow } = useCustomFlow()

	const { draftList } = useFlowStore()

	const newId = useMemo(() => flow?.id ?? "", [flow?.id])

	const onDeleteItem = useMemoizedFn(async (draftId: string) => {
		await FlowApi.deleteFlowDraft(newId, draftId)
		initDraftList?.(newId)
		// mutate("/api/v1/flows/${flowId}/draft/queries")
		magicToast.success(t("common.deleteSuccess", { ns: "flow" }))
	})

	const onSwitchDraft = useMemoizedFn((draft: FlowDraft.ListItem) => {
		if (!hasEditRight(flow?.user_operation)) return
		Modal.confirm({
			title: resolveToString(t("common.rollbackDesc", { ns: "flow" }), {
				versionName: draft.name,
			}),
			okText: t("common.confirm", { ns: "flow" }),
			cancelText: t("common.cancel", { ns: "flow" }),
			onOk: async () => {
				const draftDetail = await FlowApi.getFlowDraftDetail(newId, draft.id)

				const decodeFlow = unShadowFlow(draftDetail.magic_flow)
				// @ts-ignore
				setCurrentFlow({
					...decodeFlow,
					draft_id: draft.id,
					code: decodeFlow?.id,
					enabled: flow?.enabled || false,
					updated_at: draftDetail.updated_at,
				})
				showFlowIsDraftToast()
				setFalse()
				magicToast.success(
					resolveToString(t("common.rollbackSuccess", { ns: "flow" }), {
						versionName: draft.name,
					}),
				)
			},
		})
	})

	const Title = useMemo(() => {
		return (
			<div className={styles.title}>
				<div className={styles.topTitle}>{`${t("common.draftBox", {
					ns: "flow",
				})}（${draftList.length}）`}</div>
				{draftList.length > 0 && (
					<div className={styles.topDesc}>{t("common.draftBoxDesc", { ns: "flow" })}</div>
				)}
			</div>
		)
	}, [draftList.length, t])

	return (
		<>
			<Tooltip title={t("common.draftList", { ns: "flow" })}>
				<Button
					type="text"
					// @ts-ignore
					theme="light"
					className={styles.copyButton}
					onClick={setTrue}
				>
					<IconHistory color="#000000" size={16} />
				</Button>
			</Tooltip>
			<Drawer
				title={Title}
				className={cx(styles.drawer, {
					[styles.isEmptyDrawer]: draftList.length === 0,
				})}
				open={open}
				onClose={setFalse}
				width="500px"
			>
				{draftList.map((draft) => {
					return (
						<DraftCardItem
							key={draft.id}
							draft={draft}
							onDeleteItem={onDeleteItem}
							flowInstance={flowInstance}
							flow={flow}
							onSwitchDraft={onSwitchDraft}
							initDraftList={initDraftList}
						/>
					)
				})}
				{draftList.length === 0 && (
					<div className={styles.emptyBlock}>
						<img src={EmptyIcon} alt="" width="100px" />
						<span className={styles.label}>
							{t("common.emptyDraftTitle", { ns: "flow" })}
						</span>
						<span className={styles.desc}>
							{t("common.emptyDraftDesc", { ns: "flow" })}
						</span>
					</div>
				)}
			</Drawer>
		</>
	)
}
