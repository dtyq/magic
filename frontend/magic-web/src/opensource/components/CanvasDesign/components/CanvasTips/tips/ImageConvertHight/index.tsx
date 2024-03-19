import { useCallback, useEffect } from "react"
import styles from "./index.module.css"
import { useCanvasUI } from "../../../../context/CanvasUIContext"

export default function ImageConvertHight() {
	const { setSubElementTooltip } = useCanvasUI()

	const handleEsc = useCallback(() => {
		setSubElementTooltip(null)
	}, [setSubElementTooltip])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleEsc()
			}
		}

		window.addEventListener("keydown", handleKeyDown)

		return () => {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [handleEsc])

	return (
		<div className={styles.imageConvertHight}>
			<span>选择放大倍数</span>
			<span className={styles.esc}>Esc</span>
			<span>退出</span>
		</div>
	)
}
