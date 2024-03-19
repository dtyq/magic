/**
 * 加载草稿的相关弱提示行为及其状态
 */

import { useMemoizedFn } from "ahooks"
import { toast, Bounce } from "react-toastify"
import { useMemo, useState } from "react"
import { Button, Flex } from "antd"
import type { Bot } from "@/opensource/types/bot"
import type { FlowDraft } from "@/opensource/types/flow"
import { useTranslation } from "react-i18next"
import styles from "../index.module.less"
import btnStyles from "../components/TestFlowButton/index.module.less"

type UseLoadFlowProps = {
	// 加载最新草稿
	loadLatestDraft: (flowCode: string, extraProps?: Record<string, any>) => Promise<void>
	isAgent: boolean
	agent: Bot.Detail
	flowId: string
}

export default function useLoadFlow({ loadLatestDraft, isAgent, agent, flowId }: UseLoadFlowProps) {
	const { t } = useTranslation()
	const [loaded, setLoaded] = useState(false)

	const LoadTips = useMemo(() => {
		return (
			<Flex className={styles.toastContent} align="center" gap={8}>
				<Flex>
					<span>{t("common.loadDraftTips", { ns: "flow" })}</span>
				</Flex>
				<Flex gap={6}>
					<Button
						type="primary"
						size="small"
						className={btnStyles.btn}
						onClick={() => {
							loadLatestDraft(
								isAgent ? agent.magicFlowEntity.id! : flowId,
								isAgent
									? {
											user_operation: agent.botEntity.user_operation,
											icon: agent.botEntity.robot_avatar,
											name: agent.botEntity.robot_name,
											// AI 助理，永远显示已启用
											enabled: true,
										}
									: {},
							)
						}}
					>
						{t("common.yes", { ns: "flow" })}
					</Button>
					<Button
						type="text"
						size="small"
						className={btnStyles.btn}
						onClick={() => {
							toast.dismiss()
						}}
					>
						{t("common.no", { ns: "flow" })}
					</Button>
				</Flex>
			</Flex>
		)
	}, [
		agent?.botEntity?.robot_avatar,
		agent?.botEntity?.robot_name,
		agent?.botEntity?.user_operation,
		agent?.magicFlowEntity?.id,
		flowId,
		isAgent,
		loadLatestDraft,
		t,
	])

	const toastToNotifyMember = useMemoizedFn((latestDraftList: FlowDraft.Detail[]) => {
		if (latestDraftList.length === 0 || loaded) return
		toast.dismiss()
		toast.info(LoadTips, {
			position: "top-right",
			autoClose: 6000,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
			progress: undefined,
			theme: "light",
			transition: Bounce,
			className: styles.toast,
		})
		setLoaded(true)
	})

	const loadConfirmUI = useMemoizedFn((latestDraftList: FlowDraft.Detail[]) => {
		// agent已经发布过且草稿不为空的情况下
		if (isAgent && latestDraftList?.length > 0 && agent.botVersionEntity) {
			toastToNotifyMember(latestDraftList)
		}
		// 非 agent 且 流程未发布 且 草稿不为空的情况下
		if (!isAgent && latestDraftList?.length > 0) {
			toastToNotifyMember(latestDraftList)
		}
	})

	return {
		toastToNotifyMember,
		loadConfirmUI,
	}
}
