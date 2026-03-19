import { Drawer, Modal, Timeline } from "antd"
import { useBoolean, useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useFlowStore } from "@/stores/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { IconArchive } from "@tabler/icons-react"
import EmptyIcon from "@/assets/logos/empty.svg"
import { cx } from "antd-style"
import { useMemo } from "react"
import type { FlowDraft } from "@/types/flow"
import { botStore } from "@/stores/bot"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { BotApi, FlowApi } from "@/apis"
import { useCustomFlow } from "../../context/CustomFlowContext/useCustomFlow"
import { hasEditRight } from "../AuthControlButton/types"
import PublishCardItem from "./PublishCardItem"
import { useStyles } from "./style"
import MagicButton from "@/components/base/MagicButton"
import magicToast from "@/components/base/MagicToaster/utils"

type PublishListButtonProps = {
	isAgent: boolean
	flow?: MagicFlow.Flow
}

function PublishListButton({ isAgent, flow }: PublishListButtonProps) {
	const { t } = useTranslation()
	const { styles } = useStyles()
	const [open, { setTrue, setFalse }] = useBoolean(false)

	const { setCurrentFlow } = useCustomFlow()

	const { publishList: flowPublishList } = useFlowStore()

	const agentPublishList = botStore.publishList

	const publishList = useMemo(() => {
		if (open) {
			if (isAgent) {
				return agentPublishList.map((item) => ({
					...item,
					name: item.version_number,
					description: item.version_description,
					modifier_info: {
						...item.magicUserEntity,
						name: item.magicUserEntity?.nickname,
						avatar: item.magicUserEntity?.avatar_url,
					},
					modifier: item.updated_uid,
					creator: item.created_uid,
					creator_info: null,
				}))
			}
			return flowPublishList
		}
		return []
	}, [open, agentPublishList, isAgent, flowPublishList])

	const onSwitchDraft = useMemoizedFn((version: FlowDraft.ListItem) => {
		if (!hasEditRight(flow?.user_operation)) return
		Modal.confirm({
			title: resolveToString(t("common.rollbackDesc", { ns: "flow" }), {
				versionName: version.name,
			}),
			okText: t("common.confirm", { ns: "flow" }),
			cancelText: t("common.cancel", { ns: "flow" }),
			onOk: async () => {
				let versionDetail = null
				if (isAgent) {
					versionDetail = await BotApi.getBotVersionDetail(version.id)
					botStore.setInstructList(versionDetail.botVersionEntity.instructs)
					setCurrentFlow({
						...versionDetail.magicFlowEntity,
						version_code: version.id,
						id: versionDetail.magicFlowEntity.id,
						user_operation: flow?.user_operation,
						icon: versionDetail.botVersionEntity.robot_avatar,
						name: versionDetail.botVersionEntity.robot_name,
					})
				} else {
					versionDetail = await FlowApi.getFlowPublishDetail(flow?.id ?? "", version.id)
					setCurrentFlow({ ...versionDetail.magic_flow, version_code: version.id })
					await FlowApi.restoreFlow(flow?.id ?? "", version.id)
				}

				setFalse()
				magicToast.success(
					resolveToString(t("common.rollbackSuccess", { ns: "flow" }), {
						versionName: version.name,
					}),
				)
			},
		})
	})

	const Title = useMemo(() => {
		return (
			<div>
				<div className={styles.topTitle}>{t("common.publishVersion", { ns: "flow" })}</div>
				<div className={styles.topDesc}>
					{t("common.publishVersionDesc", { ns: "flow" })}
				</div>
			</div>
		)
	}, [styles.topDesc, styles.topTitle, t])

	const groupPublishList = useMemo(() => {
		// Step 1: 将 created_at 分解成 created_date 和 created_time 字段
		const processedVersions = publishList.map((version) => {
			const [created_date, created_time_full] = version.created_at.split(" ")
			const created_time = created_time_full.slice(0, 5) // 获取 HH:mm 部分
			return {
				...version,
				created_date,
				created_time,
			}
		})

		// Step 2: 根据 created_date 进行分组
		const groupedVersions = processedVersions.reduce(
			(groups, version) => {
				if (!groups[version.created_date]) {
					groups[version.created_date] = []
				}
				// @ts-ignore
				groups[version.created_date].push(version)
				return groups
			},
			{} as Record<string, FlowDraft.ListItem[]>,
		)

		// Step 3: 将分组结果转换为二维数组并根据 created_date 倒序排序
		const sortedGroupedVersions = Object.keys(groupedVersions)
			// @ts-ignore
			.sort((a, b) => new Date(b) - new Date(a)) // 倒序排序
			.map((date) => groupedVersions[date])

		return sortedGroupedVersions
	}, [publishList])

	return (
		<>
			<MagicButton
				tip={t("common.versionList", { ns: "flow" })}
				className={styles.copyButton}
				onClick={setTrue}
				icon={<IconArchive size={18} color="#000000" />}
			/>
			<Drawer
				title={Title}
				className={cx(styles.drawer, {
					[styles.isEmptyDrawer]: publishList.length === 0,
				})}
				open={open}
				onClose={setFalse}
				width="500px"
			>
				<Timeline className={styles.publishTimeline}>
					{groupPublishList.map((subList) => {
						// @ts-ignore
						const createDate = subList?.[0]?.created_date
						return (
							<Timeline.Item key={createDate}>
								<div className={styles.createDate}>{createDate}</div>
								{subList.map((version) => {
									return (
										<PublishCardItem
											key={version.id}
											version={version}
											onSwitchDraft={onSwitchDraft}
											flow={flow}
										/>
									)
								})}
							</Timeline.Item>
						)
					})}
				</Timeline>
				{publishList.length === 0 && (
					<div className={styles.emptyBlock}>
						<img src={EmptyIcon} alt="" width="100px" />
						<span className={styles.label}>
							{t("common.emptyVersionTitle", { ns: "flow" })}
						</span>
						<span className={styles.desc}>
							{t("common.emptyVersionDesc", { ns: "flow" })}
						</span>
					</div>
				)}
			</Drawer>
		</>
	)
}

export default observer(PublishListButton)
