import { Flex } from "antd"
import MagicSplitter from "@/opensource/components/base/MagicSplitter"
import ChatSubSider from "../ChatSubSider"
import EmptyConversationFallback from "../EmptyFallback"
import { ChatDomId } from "../../constants"
import { useStyles } from "../../styles"

/**
 * 空状态组件
 * 当没有当前会话时显示的缺省页面
 */
function EmptyState() {
	const { styles } = useStyles()

	return (
		<Flex flex={1} className={styles.chat} id={ChatDomId.ChatContainer}>
			<MagicSplitter className={styles.splitter}>
				<MagicSplitter.Panel min={200} defaultSize={240} max={300}>
					<ChatSubSider />
				</MagicSplitter.Panel>
				<MagicSplitter.Panel>
					<EmptyConversationFallback />
				</MagicSplitter.Panel>
			</MagicSplitter>
		</Flex>
	)
}

export default EmptyState
