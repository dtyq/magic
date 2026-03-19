import { memo } from "react"
import TSIcon from "@/components/base/TSIcon"
import { useStyles } from "../styles"

interface CloseButtonProps {
	visible: boolean
	isClosing: boolean
	onClick: () => void
}

function CloseButtonComponent({ visible, isClosing, onClick }: CloseButtonProps) {
	const { styles } = useStyles()

	return (
		<div className={styles.closeButton} onClick={onClick}>
			<TSIcon
				type="ts-close-line"
				size="24"
				color="#ffffff"
				className={styles.closeIcon}
				style={{
					transition: "all 0.3s ease",
					transform: visible && !isClosing ? "rotate(180deg)" : "rotate(0deg)",
				}}
			/>
		</div>
	)
}

export const CloseButton = memo(CloseButtonComponent)
