import MagicSegmented from "@/components/base/MagicSegmented"
import { useStyles } from "../../styles"

interface SegmentedOption {
	label: string
	value: string
}

interface MessageTypeSegmentedProps {
	style?: React.CSSProperties
	options: SegmentedOption[]
	value: "chat" | "ai"
	onChange?: (value: "chat" | "ai") => void
}

function MessageTypeSegmented({ style, options, value, onChange }: MessageTypeSegmentedProps) {
	const { styles } = useStyles()

	return (
		<div className={styles.segmentedContainer} style={style}>
			<MagicSegmented
				className={styles.segmented}
				options={options}
				value={value}
				onChange={(value) => onChange?.(value as "chat" | "ai")}
			/>
		</div>
	)
}

export default MessageTypeSegmented
