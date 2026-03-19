import { memo, useMemo } from "react"
import { formatTime } from "@/utils/string"
import { Flex } from "antd"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import { useStyles } from "./style"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ChatDomId } from "@/pages/chatNew/constants"

interface MessageHeaderProps {
	sendTime: number
	isSelf: boolean
	name: string
	showUserName?: boolean
	timeFormat?: (time: number) => string
	className?: string
}

/**
 * 消息头
 */
const MessageHeader = memo(function MessageHeader({
	sendTime,
	isSelf,
	name,
	showUserName = true,
	timeFormat = formatTime,
	className,
}: MessageHeaderProps) {
	const { fontSize } = useFontSize()
	const isMobile = useIsMobile()
	const { styles, cx } = useStyles({ fontSize, isMobile })

	const formattedTime = useMemo(() => {
		return timeFormat(sendTime)
	}, [sendTime, timeFormat])

	return (
		<Flex
			className={cx(styles.messageInfo, ChatDomId.MessageHeader, className)}
			align="center"
			gap={4}
			justify={isSelf ? "flex-end" : "flex-start"}
		>
			{showUserName && <span className={styles.name}>{name}</span>}
			<span className={styles.time}>{formattedTime}</span>
		</Flex>
	)
})

export default MessageHeader
