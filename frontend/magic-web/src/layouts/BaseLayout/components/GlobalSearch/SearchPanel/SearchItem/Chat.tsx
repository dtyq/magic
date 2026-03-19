import MagicIcon from "@/components/base/MagicIcon"
import { IconUserFilled } from "@tabler/icons-react"
import type { GlobalSearch } from "@/types/search"
import { useSearchItemCommonStyles } from "./styles"
import HighlightText from "../HighlightText"

interface SearchItemChatProps {
	item: GlobalSearch.ChatItem
}

function Chat(props: SearchItemChatProps) {
	const { item } = props

	const { styles } = useSearchItemCommonStyles()

	return (
		<div className={styles.item}>
			<div className={styles.icon}>
				<MagicIcon size={20} component={IconUserFilled} style={{ flex: "none" }} />
			</div>
			<div className={styles.wrapper}>
				<div className={styles.title}>
					<HighlightText text={item?.name} />
				</div>
				<div className={styles.desc}>
					<HighlightText text="成员：曾冠霖(大白)" />
				</div>
			</div>
		</div>
	)
}

export default Chat
