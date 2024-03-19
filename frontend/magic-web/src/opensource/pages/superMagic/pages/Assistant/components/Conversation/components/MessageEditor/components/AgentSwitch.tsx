import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { Bot } from "@/opensource/types/bot"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import { useMemoizedFn, useMount } from "ahooks"
import { BotApi } from "@/opensource/apis"
import MagicButton from "@/opensource/components/base/MagicButton"
import { Virtuoso } from "react-virtuoso"
import MagicSearch from "@/opensource/components/base/MagicSearch"
import useSearchValue from "../../../../TopicPanel/hooks/useSearchValue"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import { useChatWithMember } from "@/opensource/hooks/chat/useChatWithMember"
import { MessageReceiveType } from "@/opensource/types/chat"
import { SpinLoading } from "antd-mobile"
import SkeletonAvatar from "antd/es/skeleton/Avatar"
import SkeletonInput from "antd/es/skeleton/Input"
import AgentList from "./AgentList"
import { UserAvailableAgentInfo } from "@/opensource/apis/modules/chat/types"
import AntdSkeleton from "@/opensource/components/base/AntdSkeleton"

const useStyles = createStyles(({ css, token, prefixCls }) => ({
	container: css`
		padding: 4px 8px;
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		background-color: ${token.magicColorUsages.primaryLight.default};
		border-radius: 4px;
	`,
	userInfo: css`
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0 6px;
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 12px;
		font-style: normal;
		font-weight: 600;
		line-height: 16px;
	`,
	agentList: css`
		padding: 8px;
		height: fit-content;
		width: 200px;
		overflow-y: auto;
		background-color: ${token.magicColorUsages.bg[0]};
		box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
		border-radius: 12px;
	`,
	agentItem: css`
		display: flex;
		align-items: center;
		gap: 4px;
		height: 32px;
		border-radius: 8px;
		padding: 0 4px;
		cursor: pointer;

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}
	`,
	agentSearch: css`
		background-color: ${token.magicColorUsages.bg[0]};
		margin-bottom: 4px;
	`,
	agentItemSkeleton: css`
		--${prefixCls}-control-height: 16px;
	`,
	agentSwitchButton: css`
		color: ${token.magicColorUsages.primary.default};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
	`,
}))

const AgentSwitch = ({
	agent,
	onSwitchAgent,
}: {
	agent?: UserAvailableAgentInfo
	onSwitchAgent: (agent?: UserAvailableAgentInfo) => void
}) => {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const [open, setOpen] = useState(true)
	const [isInitial, setIsInitial] = useState(true)

	const [isFetching, setIsFetching] = useState(false)
	const [onSwitching, setOnSwitching] = useState(false)
	const chatWith = useChatWithMember()
	const handleSwitchAgent = useMemoizedFn(async (target: UserAvailableAgentInfo) => {
		setOnSwitching(true)
		const currentAgent = agent
		try {
			onSwitchAgent(target)
			const res = await BotApi.registerAndAddFriend(target.id)
			if (res.user_id) {
				await chatWith(res.user_id, MessageReceiveType.Ai, false)
			}
		} catch (error) {
			onSwitchAgent(currentAgent)
			console.error(error)
		} finally {
			setOnSwitching(false)
			setOpen(false)
		}
	})

	useMount(() => {
		setOpen(false)
		setIsInitial(false)
	})

	return (
		<>
			{
				<FlexBox align="center" justify="center" className={styles.container}>
					{(agent || isFetching) && (
						<>
							{t("currentChatAgentTip.chatting")}
							<div className={styles.userInfo}>
								{!agent && isFetching ? (
									<AntdSkeleton.Avatar size={20} active />
								) : (
									<MagicAvatar src={agent?.agent_avatar} size={20} />
								)}
								{!agent && isFetching ? (
									<AntdSkeleton.Input
										className={styles.agentItemSkeleton}
										active
									/>
								) : (
									agent?.robot_name
								)}
							</div>
							{t("currentChatAgentTip.conversation")}
						</>
					)}
					<MagicDropdown
						open={open}
						onOpenChange={setOpen}
						trigger={["click"]}
						popupRender={() => {
							return (
								<AgentList
									isFetching={isFetching}
									setIsFetching={setIsFetching}
									switching={onSwitching}
									setSwitching={setOnSwitching}
									agent={agent}
									onSwitchAgent={handleSwitchAgent}
									style={{
										display: isInitial ? "none" : "block",
									}}
								/>
							)
						}}
					>
						<MagicButton size="small" type="link" className={styles.agentSwitchButton}>
							{t("assistant.select")}
						</MagicButton>
					</MagicDropdown>
				</FlexBox>
			}
		</>
	)
}

export default observer(AgentSwitch)
