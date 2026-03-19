import type { GroupConversationDetail } from "@/types/chat/conversation"
import { createStyles } from "antd-style"
import { MessageReceiveType } from "@/types/chat"
import { useMyGroupsData } from "../contacts/hooks/useMyGroupsData"
import MagicNavBar from "@/components/base-mobile/MagicNavBar"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { useChatWithMember } from "@/hooks/chat/useChatWithMember"
import { Flex } from "antd"
import MagicAvatar from "@/components/base/MagicAvatar"
import MagicInfiniteList from "@/components/business/MagicInfiniteList"
import { observer } from "mobx-react-lite"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { useMemoizedFn } from "ahooks"
import { ListLoadingSkeleton } from "@/components/base/Skeleton"

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			height: calc(100% - 50px);
		`,
		title: css`
			color: ${token.magicColorUsages?.text?.[0]};
			text-align: center;
			font-size: ${token.magicFontUsages.response.text16px};
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

const Item = observer(
	({ item }: { item: GroupConversationDetail & { conversation_id: string } }) => {
		const { styles } = useStyles()
		const chatWith = useChatWithMember()

		const handleItemClick = () => {
			chatWith(item.id, MessageReceiveType.Group, true)
		}
		return (
			<Flex align="center" gap={10} onClick={handleItemClick} className={styles.item}>
				<MagicAvatar src={item.group_avatar} size={30}>
					{item.group_name}
				</MagicAvatar>
				<div style={{ flex: 1 }}>{item.group_name}</div>
			</Flex>
		)
	},
)

function MyGroups() {
	const { styles } = useStyles()
	const navigate = useNavigate()
	const { t } = useTranslation("interface")

	// Use the refactored hook
	const { fetchMyGroupsData, initialData } = useMyGroupsData()

	// 刷新列表
	const handleRefresh = useMemoizedFn(async () => {
		// MagicInfiniteList 会自动通过 dataFetcher 重新获取数据
		return
	})

	return (
		<>
			<MagicNavBar
				onBack={() =>
					navigate({
						delta: -1,
						viewTransition: { type: "slide", direction: "right" },
					})
				}
			>
				<span className={styles.title}>{t("contacts.subSider.myGroups")}</span>
			</MagicNavBar>
			<MagicPullToRefresh
				onRefresh={handleRefresh}
				showSuccessMessage={false}
				height="calc(100% - 48px)"
			>
				<div className={styles.container}>
					<MagicInfiniteList<GroupConversationDetail & { conversation_id: string }>
						dataFetcher={fetchMyGroupsData}
						renderItem={(
							item: GroupConversationDetail & { conversation_id: string },
						) => {
							return <Item item={item} />
						}}
						getItemKey={(item: GroupConversationDetail & { conversation_id: string }) =>
							item.id
						}
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

export default MyGroups
