import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import type { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import MagicNavBar from "@/components/base-mobile/MagicNavBar"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { MagicButton } from "@dtyq/magic-admin/components"
import { Flex } from "antd"
import MagicAvatar from "@/components/base/MagicAvatar"
import MagicInfiniteList from "@/components/business/MagicInfiniteList"
import { useAiAssistantData } from "../contacts/hooks/useAiAssistantData"
import { useOpenAiAssistantChat } from "../contacts/hooks/useOpenAiAssistantChat"
import { RouteName } from "@/routes/constants"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ListLoadingSkeleton } from "@/components/base/Skeleton"

const mobileScrollTargetId = "contacts-ai-assistant-mobile-scroll"

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			height: calc(100% - 50px);
		`,
		title: css`
			color: ${token.magicColorUsages?.text?.[0]};
			text-align: center;
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px;
		`,
		itemWrapper: css`
			--${prefixCls}-list-item-padding: 10px;
			border-radius: 8px;
			background-color: ${token.colorBgContainer};
			border: 1px solid ${token.magicColorUsages?.border};
			margin: 10px;
		`,
		item: css`
			width: 100%;
		`,
		content: css`
			flex: 1;
			min-width: 0;
		`,
		name: css`
			color: ${token.colorText};
			font-size: 14px;
			font-weight: 500;
			line-height: 20px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		description: css`
			color: ${token.colorTextDescription};
			font-size: 12px;
			line-height: 18px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
	}
})

function AiAssistant() {
	const { styles } = useStyles()
	const navigate = useNavigate()
	const { t } = useTranslation("interface")
	const openAiAssistantChat = useOpenAiAssistantChat()

	const { fetchAiAssistantData, initialData } = useAiAssistantData()

	const handleRefresh = useMemoizedFn(async () => {
		return
	})

	const renderItem = useMemoizedFn((item: UserAvailableAgentInfo) => {
		const handleItemClick = () => {
			void openAiAssistantChat(item)
		}

		return (
			<Flex align="center" gap={10} onClick={handleItemClick} className={styles.item}>
				<MagicAvatar src={item.agent_avatar || item.robot_avatar} size={30}>
					{item.agent_name || item.robot_name}
				</MagicAvatar>
				<div className={styles.content}>
					<div className={styles.name}>{item.agent_name || item.robot_name}</div>
					<div className={styles.description}>
						{item.agent_description || item.robot_description}
					</div>
				</div>
			</Flex>
		)
	})

	return (
		<>
			<MagicNavBar
				onBack={() =>
					navigate({
						delta: -1,
						viewTransition: {
							type: "slide",
							direction: "right",
						},
					})
				}
				right={
					<MagicButton
						type="text"
						onClick={() => {
							navigate({
								name: RouteName.Explore,
							})
						}}
					>
						{t("explore.assistantMarket")}
					</MagicButton>
				}
			>
				<span className={styles.title}>{t("sider.aiAssistant")}</span>
			</MagicNavBar>
			<MagicPullToRefresh
				containerId={mobileScrollTargetId}
				onRefresh={handleRefresh}
				showSuccessMessage={false}
				height="calc(100% - 48px)"
			>
				<div className={styles.container}>
					<MagicInfiniteList<UserAvailableAgentInfo>
						key="contacts-ai-assistant-mobile"
						dataFetcher={fetchAiAssistantData}
						renderItem={renderItem}
						getItemKey={(item: UserAvailableAgentInfo) => item.id}
						useDefaultItemStyles={false}
						itemClassName={styles.itemWrapper}
						initialData={initialData}
						initialLoadingComponent={<ListLoadingSkeleton count={7} avatarSize={30} />}
						scrollableTarget={mobileScrollTargetId}
					/>
				</div>
			</MagicPullToRefresh>
		</>
	)
}

export default AiAssistant
