import { MessageReceiveType } from "@/opensource/types/chat"
import type { Friend } from "@/opensource/types/contact"
import { createStyles } from "antd-style"
import { lazy } from "react"
import { useChatWithMember } from "@/opensource/hooks/chat/useChatWithMember"
import userInfoStore from "@/opensource/stores/userInfo"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { useAiAssistantData } from "./hooks/useAiAssistantData"
import { observer } from "mobx-react-lite"
import MagicInfiniteList from "@/opensource/components/business/MagicInfiniteList"
import { getUserName } from "@/opensource/utils/modules/chat"
import { Flex } from "antd"
import { MagicAvatar } from "@/opensource/components/base"

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

const Item = observer(({ item }: { item: Friend }) => {
	const { styles } = useStyles()
	const user = userInfoStore.get(item.friend_id)
	const chatWith = useChatWithMember()

	const handleItemClick = () => {
		chatWith(item.friend_id, MessageReceiveType.Ai, true)
	}
	return (
		<Flex align="center" gap={10} onClick={handleItemClick} className={styles.item}>
			<MagicAvatar src={user?.avatar_url} size={40}>
				{getUserName(user)}
			</MagicAvatar>
			<div style={{ flex: 1 }}>{user?.real_name || item.friend_id}</div>
		</Flex>
	)
})

const AiAssistant = observer(function AiAssistant() {
	const { styles } = useStyles()

	const { fetchAiAssistantData, initialData } = useAiAssistantData()

	return (
		<MagicInfiniteList<Friend>
			dataFetcher={fetchAiAssistantData}
			initialData={initialData}
			renderItem={(item: Friend) => <Item item={item} />}
			getItemKey={(item: Friend) => item.friend_id}
			useDefaultItemStyles={false}
			itemClassName={styles.itemWrapper}
		/>
	)
})

const AiAssistantMobile = lazy(() => import("@/opensource/pages/contactsMobile/aiAssistant"))

export default () => {
	const isMobile = useIsMobile()
	return isMobile ? <AiAssistantMobile /> : <AiAssistant />
}
