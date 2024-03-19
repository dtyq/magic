import { Flex } from "antd"
import { cx } from "antd-style"
import useToolsMode from "./hooks/useToolsMode"
import styles from "./ModeSelect.module.less"

// eslint-disable-next-line react-refresh/only-export-components
export const enum ToolsMode {
	Parameter = "parameter",
	LLM = "llm",
}

type ModeSelectProps = {
	value?: ToolsMode
	onChange?: (value: ToolsMode) => void
}

export default function ModeSelect({ value, onChange }: ModeSelectProps) {
	const { modeOptions } = useToolsMode()
	return (
		<Flex className={styles.mode} gap={10}>
			{modeOptions.map((modeOption) => {
				return (
					<Flex
						className={cx(styles.modeCard, {
							[styles.activeCard]: value === modeOption.key,
						})}
						key={modeOption.key}
						onClick={() => {
							onChange?.(modeOption.key)
						}}
					>
						<img className={styles.modeImg} src={modeOption.img} alt="" height={50} />
						<Flex vertical gap={6} justify="center">
							<span className={styles.title}>{modeOption.title}</span>
							<span className={styles.desc}>{modeOption.desc}</span>
						</Flex>
					</Flex>
				)
			})}
		</Flex>
	)
}
