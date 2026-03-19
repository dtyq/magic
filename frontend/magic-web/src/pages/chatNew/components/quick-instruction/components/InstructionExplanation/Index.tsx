import type { InstructionExplanation as InstructionExplanationType } from "@/types/bot"
import type { PopoverProps } from "antd"
import { Flex, Popover } from "antd"
import { memo } from "react"
import { useStyles } from "./styels"

interface InstructionExplanationProps extends PopoverProps {
	data?: InstructionExplanationType
}

/**
 * 快捷指令说明
 */
const InstructionExplanation = memo(({ data, children, ...rest }: InstructionExplanationProps) => {
	const { styles } = useStyles()

	if (!data || (!data?.temp_image_url && !data?.description && !data?.name)) return children

	return (
		<Popover
			placement="right"
			autoAdjustOverflow
			rootClassName={styles.container}
			content={
				<Flex vertical gap={4}>
					{data.temp_image_url && (
						<img src={data.temp_image_url} className={styles.image} alt={data.name} />
					)}
					<div className={styles.title}>{data.name}</div>
					<div className={styles.description}>{data.description}</div>
				</Flex>
			}
			{...rest}
		>
			{children}
		</Popover>
	)
})

export default InstructionExplanation
