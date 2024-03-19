import { IconAlertCircleFilled, IconCircleCheckFilled } from "@tabler/icons-react"
import { createStyles, cx } from "antd-style"
import type { Dispatch, SetStateAction } from "react"
import { useMemo } from "react"
import Tags from "@dtyq/magic-flow/dist/MagicFlow/components/FlowHeader/components/Tags"
import { Spin, Flex, Popconfirm, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useMemoizedFn } from "ahooks"
import type { Bot } from "@/opensource/types/bot"
import { BotApi, FlowApi } from "@/opensource/apis"
import { Status } from "../agent/constants"

const useStyles = createStyles(({ css }) => {
	return {
		tag: css`
			background-color: #f0f0f5;
			border-radius: 4px;
			color: #1d1c2399;
			padding: 2px 8px;
			display: flex;
			align-items: center;
			max-width: 400px;
		`,
		tagIcon: css`
			font-size: 10px;
			margin-right: 4px;
			width: 14px;
			height: 14px;
		`,
		checked: css`
			color: #28a32d;
		`,
		warning: css`
			color: #ff7d00;
		`,
		tagText: css`
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			letter-spacing: 0.12px;
			line-height: 16px;
			overflow: hidden;
			text-overflow: ellipsis;
			text-wrap: nowrap;
		`,
		spin: css`
			.magic-spin-dot {
				height: 12px;
				width: 12px;
				color: rgba(49, 92, 236, 1);
			}
		`,
	}
})

type UseCustomTagListProps = {
	isMainFlow: boolean
	isSaving: boolean
	lastSaveTime: string
	flow?: MagicFlow.Flow
	isAgent: boolean
	agent: Bot.Detail
	setCurrentFlow: Dispatch<SetStateAction<MagicFlow.Flow | undefined>>
}

export default function useCustomTagList({
	isSaving,
	lastSaveTime,
	flow,
	isAgent,
	agent,
	setCurrentFlow,
}: UseCustomTagListProps) {
	const { t } = useTranslation()
	const { styles } = useStyles()

	const statusTagItem = useMemo(() => {
		return {
			icon: flow?.enabled ? (
				<IconCircleCheckFilled className={cx(styles.tagIcon, styles.checked)} />
			) : (
				<IconAlertCircleFilled className={cx(styles.tagIcon, styles.warning)} />
			),
			text: flow?.enabled
				? t("common.enabled", { ns: "flow" })
				: t("common.flowDisable", { ns: "flow" }),
		}
	}, [flow?.enabled, styles.checked, styles.tagIcon, styles.warning, t])

	// 当前tag列表
	const tagList = useMemo(() => {
		const result = [
			...(flow?.description
				? [
						{
							icon: null as any,
							text: flow?.description || "",
						},
					]
				: []),
		]
		return result
	}, [flow?.description])

	const customTagList = useMemo(() => {
		const result = [
			...(isSaving
				? [
						{
							icon: <Spin size="small" className={styles.spin} />,
							text: `${t("common.autoSaving", { ns: "flow" })}...`,
						},
					]
				: []),
			...(!isSaving && lastSaveTime
				? [
						{
							icon: (
								<IconCircleCheckFilled
									className={cx(styles.tagIcon, styles.checked)}
								/>
							),
							text: `${lastSaveTime} ${t("common.savedText", { ns: "flow" })}`,
						},
					]
				: []),
		]

		if (result.length > 0) return result
		return []
	}, [isSaving, lastSaveTime, styles.checked, styles.spin, styles.tagIcon, t])

	const updateEnableStatus = useMemoizedFn(async () => {
		if (!isAgent && flow?.id) {
			await FlowApi.changeEnableStatus(flow.id)
		} else {
			await BotApi.updateBotStatus(
				agent.botEntity?.id,
				flow?.enabled ? Status.disable : Status.enable,
			)
		}
		if (flow) {
			setCurrentFlow({
				...flow,
				enabled: !flow?.enabled,
			})
		}
	})

	const customTags = useMemo(() => {
		return (
			<Flex gap={8}>
				<Popconfirm
					title={
						flow?.enabled
							? t("common.checkToBan", { ns: "flow" })
							: t("common.checkToEnable", { ns: "flow" })
					}
					onConfirm={updateEnableStatus}
					icon={null}
				>
					<Flex className={cx(styles.tag)}>
						{statusTagItem.icon}
						<Tooltip title={statusTagItem.text}>
							<span className={cx(styles.tagText)}>{statusTagItem.text}</span>
						</Tooltip>
					</Flex>
				</Popconfirm>
				<Tags list={[...tagList, ...customTagList]} />
			</Flex>
		)
	}, [
		flow?.enabled,
		t,
		updateEnableStatus,
		styles.tag,
		styles.tagText,
		statusTagItem.icon,
		statusTagItem.text,
		tagList,
		customTagList,
	])

	return {
		customTags,
	}
}
