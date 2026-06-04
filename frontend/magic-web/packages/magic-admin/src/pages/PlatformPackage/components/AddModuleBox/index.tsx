import { memo } from "react"
import { createStyles } from "antd-style"
import { Flex } from "antd"
import { IconPlus } from "@tabler/icons-react"

export const useStyles = createStyles(({ css, token }) => {
	return {
		addService: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[2]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			min-width: 200px;
			width: 100%;
			height: 120px;
			background-color: ${token.magicColorUsages.bg[0]};
			cursor: pointer;
		`,
		disabledAddService: css`
			cursor: not-allowed;
			background-color: ${token.magicColorUsages.fill[0]};
		`,
	}
})

interface AddModuleBoxProps {
	className?: string
	hasEditRight: boolean
	text: string

	onAddClick: () => void
}

const AddModuleBox = memo(({ className, onAddClick, hasEditRight, text }: AddModuleBoxProps) => {
	const { styles, cx } = useStyles()

	return (
		<Flex
			vertical
			gap={8}
			className={cx(styles.addService, !hasEditRight && styles.disabledAddService, className)}
			align="center"
			justify="center"
			onClick={onAddClick}
		>
			<IconPlus size={30} />
			<span>{text}</span>
		</Flex>
	)
})

export default AddModuleBox
