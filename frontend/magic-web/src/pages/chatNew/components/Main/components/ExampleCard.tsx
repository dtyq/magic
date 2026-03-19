import { Flex } from "antd"
import { createStyles, cx } from "antd-style"
import type { HTMLAttributes } from "react"

const useExampleMessageStyles = createStyles(({ isDarkMode, token }) => {
	return {
		exampleMessage: {
			padding: "10px 14px",
			borderRadius: 100,
			border: `1px solid ${token.colorBorder}`,
			background: isDarkMode ? token.magicColorScales.grey[7] : token.colorWhite,
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1],
			fontSize: 14,
			fontWeight: 400,
			lineHeight: "20px",
			cursor: "pointer",
			":hover": {
				color: isDarkMode ? "rgba(255,255,255,0.9)" : token.magicColorUsages.text[2],
			},
		},
	}
})

interface ExampleCardProps extends HTMLAttributes<HTMLDivElement> {
	icon: string
	content: string
}

function ExampleCard({ icon, content, className, ...props }: ExampleCardProps) {
	const { styles } = useExampleMessageStyles()

	return (
		<Flex className={cx(styles.exampleMessage, className)} align="center" gap={4} {...props}>
			<span>{icon}</span>
			<span>{content}</span>
		</Flex>
	)
}

export default ExampleCard
