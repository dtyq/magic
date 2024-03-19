import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconEye, IconEyeCheck } from "@tabler/icons-react"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { memo, HTMLAttributes } from "react"

const useStyles = createStyles(({ css, isDarkMode, token }) => ({
	icon: {
		color: isDarkMode ? token.magicColorScales.grey[6] : token.magicColorUsages.text[3],
	},
	text: css`
		color: ${isDarkMode ? token.magicColorScales.grey[6] : token.magicColorUsages.text[3]};
		text-align: justify;
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		user-select: none;
	`,
}))

// icon独立，避免重复渲染
const StatusIcon = memo(function StatusIcon({
	icon: Icon,
	className,
}: {
	icon: typeof IconEye | typeof IconEyeCheck
	className: string
}) {
	return <MagicIcon component={Icon} size={16} className={className} />
})

// 文本独立，避免重复渲染
const StatusText = memo(function StatusText({
	text,
	className,
}: {
	text: string
	className: string
}) {
	return <span className={className}>{text}</span>
})

interface StatusContentProps extends HTMLAttributes<HTMLDivElement> {
	icon: typeof IconEye | typeof IconEyeCheck
	text: string
	messageId?: string
}

// 内容独立，避免重复渲染
const StatusContent = memo(function StatusContent({
	icon: Icon,
	text,
	messageId,
	className,
}: StatusContentProps) {
	const { styles } = useStyles()
	return (
		<Flex
			align="center"
			justify="flex-end"
			gap={2}
			data-message-id={messageId}
			className={className}
		>
			<StatusIcon icon={Icon} className={styles.icon} />
			<StatusText text={text} className={styles.text} />
		</Flex>
	)
})

export default StatusContent
