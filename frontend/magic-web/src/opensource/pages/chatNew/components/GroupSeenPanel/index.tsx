import MagicMemberAvatar from "@/opensource/components/business/MagicMemberAvatar"
import { resolveToString } from "@dtyq/es6-template-strings"

import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import GroupSeenPanelStore from "@/opensource/stores/chatNew/groupSeenPanel"
import { useGroupMessageSeenPopoverStyles } from "./style"
import { observer } from "mobx-react-lite"
import { useEffect, useRef } from "react"
import { useDeepCompareEffect, useHover, useSize } from "ahooks"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { IconX } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"

const GroupSeenPanel = observer(() => {
	const { t } = useTranslation("interface")
	const { open, messageReceiveList, position, loading } = GroupSeenPanelStore
	const containerRef = useRef<HTMLDivElement>(null)
	const actualSize = useSize(containerRef)
	const isHover = useHover(containerRef)

	useDeepCompareEffect(() => {
		if (actualSize) {
			GroupSeenPanelStore.setSize({ width: actualSize.width, height: actualSize.height })
		}
	}, [actualSize])

	useEffect(() => {
		GroupSeenPanelStore.setIsHover(isHover)
	}, [isHover])

	const { styles } = useGroupMessageSeenPopoverStyles()

	if (!open) {
		return null
	}

	return (
		<div
			ref={containerRef}
			className={styles.content}
			style={{
				left: position.x,
				top: position.y,
			}}
		>
			<Flex gap={8} align="center" justify="space-between" className={styles.title}>
				{t("chat.message.groupSeenPopover.title")}
				<div className={styles.close}>
					<MagicIcon
						component={IconX}
						onClick={() => GroupSeenPanelStore.closePanel(true)}
					/>
				</div>
			</Flex>
			<MagicSpin section spinning={loading}>
				<Flex>
					<Flex vertical flex={1} gap={8} className={styles.section}>
						<span className={styles.text}>
							{resolveToString(t("chat.unseenCount"), {
								count: messageReceiveList?.unseen_list.length,
							})}
						</span>
						<Flex gap={8} vertical className={styles.list}>
							{messageReceiveList?.unseen_list.map((uid) => (
								<MagicMemberAvatar
									showPopover={false}
									showName="horizontal"
									key={uid}
									uid={uid}
									size={27}
								/>
							))}
						</Flex>
					</Flex>
					<div className={styles.divider} />
					<Flex vertical flex={1} gap={8} className={styles.section}>
						<span className={styles.text}>
							{resolveToString(t("chat.seenCount"), {
								count: messageReceiveList?.seen_list.length,
							})}
						</span>
						<Flex gap={8} vertical className={styles.list}>
							{messageReceiveList?.seen_list.map((uid) => (
								<MagicMemberAvatar
									showPopover={false}
									showName="horizontal"
									key={uid}
									uid={uid}
									size={27}
								/>
							))}
						</Flex>
					</Flex>
				</Flex>
			</MagicSpin>
		</div>
	)
})

export default GroupSeenPanel
