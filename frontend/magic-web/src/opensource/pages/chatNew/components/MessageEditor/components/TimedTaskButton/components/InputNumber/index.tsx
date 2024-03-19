import MagicButton from "@/opensource/components/base/MagicButton"
import { Flex, Form, InputNumber } from "antd"
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { memo } from "react"
import useStyles from "./styles"

const InputNumberComp = memo(function InputNumberComp({
	name,
	width = 100,
	onIncrease,
	onDecrease,
	onChange,
}: {
	name: string | string[]
	width?: number
	onIncrease: (name: string | string[]) => void
	onDecrease: (name: string | string[]) => void
	onChange?: (value: number | null) => void
}) {
	const { styles } = useStyles()
	return (
		<Flex align="center" gap={4}>
			<Form.Item noStyle name={name} initialValue={1}>
				<InputNumber
					min={1}
					style={{ width }}
					className={styles.inputNumber}
					onChange={(value) => onChange?.(value)}
					// defaultValue={1}
				/>
			</Form.Item>
			<Flex vertical gap={0} className={styles.buttonGroup}>
				<MagicButton
					type="text"
					className={styles.button}
					icon={<IconChevronUp size={8} />}
					onClick={() => onIncrease(name)}
				/>
				<MagicButton
					type="text"
					className={styles.button}
					icon={<IconChevronDown size={8} />}
					onClick={() => onDecrease(name)}
				/>
			</Flex>
		</Flex>
	)
})

export default InputNumberComp
