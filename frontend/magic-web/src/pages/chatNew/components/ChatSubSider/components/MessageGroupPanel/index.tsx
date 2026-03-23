import { Fragment, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import type { CollapseProps } from "antd"
import { titleWithCount } from "@/utils/modules/chat"
import type Conversation from "@/models/chat/conversation"
import ConversationItem from "../ConversationItem"
import useStyles from "../../style"
import { MessageGroupKey, RenderedLists } from "../../types"
import { SegmentedKey } from "../../constants"

interface MessageGroupPanelProps {
	topGroupList: string[]
	singleGroupList: string[]
	groupGroupList: string[]
	renderedLists: RenderedLists
	activeKeys: string[]
	listsReady: boolean
	onTogglePanel: (key: string) => void
	onConversationClick: (conversation: Conversation) => void
}

/**
 * Message group panel component
 */
function MessageGroupPanel({
	topGroupList,
	singleGroupList,
	groupGroupList,
	renderedLists,
	activeKeys,
	listsReady,
	onTogglePanel,
	onConversationClick,
}: MessageGroupPanelProps) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys])

	const renderList = (key: MessageGroupKey, list?: string[]) => {
		if (!listsReady) return undefined
		if (!list?.length) return undefined
		const items = renderedLists[key] ?? []
		if (!items.length) return undefined

		return (
			<div className={styles.virtualList} style={{ height: "auto" }}>
				{items.map((item) => (
					<div key={item} className={styles.virtualItem}>
						<ConversationItem
							conversationId={item}
							onClick={onConversationClick}
							domIdPrefix={SegmentedKey.Message}
						/>
					</div>
				))}
			</div>
		)
	}

	const childrenMap = useMemo(() => {
		return {
			[MessageGroupKey.Pinned]: renderList(MessageGroupKey.Pinned, topGroupList),
			[MessageGroupKey.Single]: renderList(MessageGroupKey.Single, singleGroupList),
			[MessageGroupKey.Group]: renderList(MessageGroupKey.Group, groupGroupList),
		}
	}, [
		groupGroupList,
		listsReady,
		onConversationClick,
		renderedLists,
		singleGroupList,
		styles.virtualItem,
		styles.virtualList,
		topGroupList,
	])

	const collapseItems = useMemo(() => {
		return [
			topGroupList.length
				? {
					label: (
						<span className={styles.collapseLabel}>
							{titleWithCount(t("chat.subSider.pinned"), topGroupList.length)}
						</span>
					),
					children: childrenMap[MessageGroupKey.Pinned],
					key: MessageGroupKey.Pinned,
				}
				: undefined,
			singleGroupList.length
				? {
					label: (
						<span className={styles.collapseLabel}>
							{titleWithCount(
								t("chat.subSider.conversation"),
								singleGroupList.length,
							)}
						</span>
					),
					children: childrenMap[MessageGroupKey.Single],
					key: MessageGroupKey.Single,
				}
				: undefined,
			groupGroupList.length
				? {
					label: (
						<span className={styles.collapseLabel}>
							{titleWithCount(
								t("chat.subSider.groupConversation"),
								groupGroupList.length,
							)}
						</span>
					),
					children: childrenMap[MessageGroupKey.Group],
					key: MessageGroupKey.Group,
				}
				: undefined,
		].filter(Boolean) as CollapseProps["items"]
	}, [
		childrenMap,
		groupGroupList.length,
		singleGroupList.length,
		styles.collapseLabel,
		t,
		topGroupList.length,
	])

	return (
		<>
			{collapseItems?.map((item) => {
				if (!item || !item.children) return null
				const key = item.key as string
				const isOpen = activeKeySet.has(key)
				const childrenLength = (() => {
					switch (key) {
						case MessageGroupKey.Pinned:
							return topGroupList.length
						case MessageGroupKey.Single:
							return singleGroupList.length
						case MessageGroupKey.Group:
							return groupGroupList.length
					}
					return 0
				})()

				return (
					<Fragment key={key}>
						<button
							type="button"
							className={styles.panelHeader}
							onClick={() => onTogglePanel(key)}
							aria-expanded={isOpen}
						>
							<span className={styles.panelLabel}>{item.label}</span>
							{isOpen ? (
								<IconChevronUp className={styles.panelCaret} size={22} />
							) : (
								<IconChevronDown className={styles.panelCaret} size={22} />
							)}
						</button>
						<div
							className={styles.panelBody}
							style={{
								display: isOpen ? "flex" : "none",
								height: isOpen ? "auto" : 0,
								minHeight: isOpen ? Math.min(childrenLength, 3) * 64 : 0,
							}}
							aria-hidden={!isOpen}
						>
							{item.children}
						</div>
					</Fragment>
				)
			})}
		</>
	)
}

export default MessageGroupPanel
