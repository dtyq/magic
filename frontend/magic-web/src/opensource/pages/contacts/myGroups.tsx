import type { GroupConversationDetail } from "@/opensource/types/chat/conversation"
import { createStyles } from "antd-style"
import { lazy } from "react"
import { useChatWithMember } from "@/opensource/hooks/chat/useChatWithMember"
import { MessageReceiveType } from "@/opensource/types/chat"
import { observer } from "mobx-react-lite"
import { useMyGroupsData } from "./hooks/useMyGroupsData"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicInfiniteList from "@/opensource/components/business/MagicInfiniteList"
import { Flex } from "antd"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		itemWrapper: css`
			--${prefixCls}-list-item-padding: 10px;
			border-radius: 8px;
			background-color: ${token.colorBgContainer};
			margin: 10px;
			border-block-end: none !important;
			transition: background-color 0.1s ease;

			&:hover {
				background-color: ${token.magicColorScales.grey[0]};
				cursor: pointer;
			}
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
				<MagicAvatar src={item.group_avatar} size={40}>
					{item.group_name}
				</MagicAvatar>
				<div style={{ flex: 1 }}>{item.group_name}</div>
			</Flex>
		)
	},
)

const MyGroups = observer(function MyGroups() {
	const { styles } = useStyles()
	const { fetchMyGroupsData, initialData } = useMyGroupsData()

	return (
		<MagicInfiniteList<GroupConversationDetail & { conversation_id: string }>
			dataFetcher={fetchMyGroupsData}
			initialData={initialData}
			renderItem={(item: GroupConversationDetail & { conversation_id: string }) => {
				return <Item item={item} />
			}}
			getItemKey={(item: GroupConversationDetail & { conversation_id: string }) => item.id}
			useDefaultItemStyles={false}
			itemClassName={styles.itemWrapper}
		/>
	)
})

const MyGroupsMobile = lazy(() => import("@/opensource/pages/contactsMobile/myGroups"))

export default () => {
	const isMobile = useIsMobile()
	return isMobile ? <MyGroupsMobile /> : <MyGroups />
}
