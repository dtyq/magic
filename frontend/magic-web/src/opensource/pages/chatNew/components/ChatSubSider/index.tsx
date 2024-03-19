import { Flex } from "antd"
import { useEffect, useMemo } from "react"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import MagicSegmented from "@/opensource/components/base/MagicSegmented"
import { observer } from "mobx-react-lite"
import type Conversation from "@/opensource/models/chat/conversation"
import { throttle } from "lodash-es"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import useStyles from "./style"
import { SegmentedKey } from "./constants"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { useMemoizedFn } from "ahooks"
import {
	useConversationGroups,
	useVirtualList,
	useCollapsePanels,
	useSegmentedControl,
} from "./hooks"
import MessageGroupPanel from "./components/MessageGroupPanel"
import AiBotsList from "./components/AiBotsList"
import SharedChatMenu from "./components/SharedChatMenu"
import EmptyChatSubSider from "./components/EmptyChatSubSider"

/**
 * Chat sidebar component
 */
const ChatSubSider = observer(() => {
	const { styles } = useStyles()

	const conversationCount = Object.keys(conversationStore.conversations).length

	const { topGroupList, singleGroupList, groupGroupList, aiGroupList, firstAvailableGroup } =
		useConversationGroups()

	const { activeSegmentedKey, aiHydrated, options, handleSegmentedChange, setAiHydrated } =
		useSegmentedControl()

	const { activeKeys, collapseAnimationDisabled, listsReady, handleTogglePanel } =
		useCollapsePanels({ firstAvailableGroup })

	const { renderedLists } = useVirtualList({
		topGroupList,
		singleGroupList,
		groupGroupList,
		aiGroupList,
		listsReady,
		aiHydrated,
	})

	const throttledSwitchConversation = useMemo(
		() =>
			throttle(
				(conversation: Conversation) => {
					conversationService.switchConversation(conversation)
				},
				800,
				{ trailing: true },
			),
		[],
	)

	useEffect(() => {
		return () => {
			throttledSwitchConversation.cancel()
		}
	}, [throttledSwitchConversation])

	useEffect(() => {
		if (!listsReady) return
		if (aiHydrated) return
		if (!aiGroupList.length) return

		const hydrateAi = () => setAiHydrated(true)
		if (typeof requestIdleCallback !== "undefined") {
			const handle = requestIdleCallback(hydrateAi)
			return () => cancelIdleCallback(handle)
		}
		const frame = requestAnimationFrame(hydrateAi)
		return () => cancelAnimationFrame(frame)
	}, [aiGroupList.length, aiHydrated, listsReady, setAiHydrated])

	const handleConversationItemClick = useMemoizedFn((conversation: Conversation) => {
		throttledSwitchConversation(conversation)
	})

	if (conversationCount === 0) {
		return (
			<EmptyChatSubSider
				activeSegmentedKey={activeSegmentedKey}
				options={options}
				handleSegmentedChange={handleSegmentedChange}
				styles={styles}
			/>
		)
	}

	return (
		<SubSiderContainer className={styles.container}>
			<Flex align="center" gap={4} className={styles.segmentedContainer}>
				<MagicSegmented
					className={styles.segmented}
					value={activeSegmentedKey}
					options={options}
					block
					onChange={handleSegmentedChange}
				/>
				{/* <MenuButton /> */}
			</Flex>
			<div className={styles.listWrapper}>
				<div
					className={styles.collapse}
					style={{
						display: activeSegmentedKey === SegmentedKey.Message ? "flex" : "none",
						transition: collapseAnimationDisabled ? "none" : undefined,
					}}
				>
					<MessageGroupPanel
						topGroupList={topGroupList}
						singleGroupList={singleGroupList}
						groupGroupList={groupGroupList}
						renderedLists={renderedLists}
						activeKeys={activeKeys}
						listsReady={listsReady}
						onTogglePanel={handleTogglePanel}
						onConversationClick={handleConversationItemClick}
					/>
				</div>
				{aiHydrated && (
					<AiBotsList
						aiGroupList={aiGroupList}
						renderedLists={renderedLists}
						activeSegmentedKey={activeSegmentedKey}
						onConversationClick={handleConversationItemClick}
					/>
				)}
			</div>
			<SharedChatMenu />
		</SubSiderContainer>
	)
})

export default ChatSubSider
