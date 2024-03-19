import type { GlobalSearch } from "@/opensource/types/search"
import { useMemoizedFn } from "ahooks"
import useAssistant from "@/opensource/pages/explore/hooks/useAssistant"
import { BotApi } from "@/opensource/apis"
import { useMagicSearchStore } from "../../store"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"

interface SearchItemAssistantProps {
	item: GlobalSearch.AssistantItem
}

function Assistant(props: SearchItemAssistantProps) {
	const { item } = props

	const { styles, cx } = useSearchItemCommonStyles()
	const closePanel = useMagicSearchStore((store) => store.closePanel)

	const { navigateConversation } = useAssistant()

	const onClick = useMemoizedFn(async () => {
		if (item?.user_id) {
			navigateConversation?.(item?.user_id)
		} else {
			const res = await BotApi.registerAndAddFriend(item.id)
			navigateConversation?.(res?.user_id)
		}
		closePanel?.()
	})

	return (
		<div className={styles.item} onClick={onClick}>
			<div
				className={styles.icon}
				style={{ backgroundImage: `url(${item?.robot_avatar})` }}
			/>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.robot_name} />
				</div>
				<div className={cx(styles.desc, styles.text3)}>
					<HighlightText text={item?.robot_description} />
				</div>
			</div>
		</div>
	)
}

export default Assistant
