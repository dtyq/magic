import { MessageReceiveType } from "@/types/chat"
import type { Friend } from "@/types/contact"
import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import { useChatWithMember } from "@/hooks/chat/useChatWithMember"
import userInfoStore from "@/stores/userInfo"
import MagicNavBar from "@/components/base-mobile/MagicNavBar"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { MagicButton } from "@dtyq/magic-admin/components"
import { Flex } from "antd"
import MagicAvatar from "@/components/base/MagicAvatar"
import { getUserName } from "@/utils/modules/chat"
import MagicInfiniteList from "@/components/business/MagicInfiniteList"
import { useAiAssistantData } from "../contacts/hooks/useAiAssistantData"
import { RouteName } from "@/routes/constants"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ListLoadingSkeleton } from "@/components/base/Skeleton"

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
	}
})

function AiAssistant() {
	const { styles } = useStyles()
	const navigate = useNavigate()
	const { t } = useTranslation("interface")
	const chatWith = useChatWithMember()

	// Use the refactored hook
	const { fetchAiAssistantData, initialData } = useAiAssistantData()

	// 刷新列表（通过重新触发 dataFetcher）
	const handleRefresh = useMemoizedFn(async () => {
		// MagicInfiniteList 会自动通过 dataFetcher 重新获取数据
		// 这里只需要返回 Promise
		return
	})

	// Render item function
	const renderItem = useMemoizedFn((item: Friend) => {
		const user = userInfoStore.get(item.friend_id)
		const handleItemClick = () => {
			chatWith(item.friend_id, MessageReceiveType.Ai, true)
		}

		return (
			<Flex align="center" gap={10} onClick={handleItemClick} className={styles.item}>
				<MagicAvatar src={user?.avatar_url} size={30}>
					{getUserName(user)}
				</MagicAvatar>
				<div style={{ flex: 1 }}>{user?.real_name || item.friend_id}</div>
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
				onRefresh={handleRefresh}
				showSuccessMessage={false}
				height="calc(100% - 48px)"
			>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchAiAssistantData}
						renderItem={renderItem}
						getItemKey={(item: Friend) => item.friend_id}
						useDefaultItemStyles={false}
						itemClassName={styles.itemWrapper}
						initialData={initialData}
						initialLoadingComponent={<ListLoadingSkeleton count={7} avatarSize={30} />}
					/>
				</div>
			</MagicPullToRefresh>
		</>
	)
}

export default AiAssistant
