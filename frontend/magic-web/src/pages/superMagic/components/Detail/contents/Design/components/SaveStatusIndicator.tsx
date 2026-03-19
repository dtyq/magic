import { useEffect, useState } from "react"
import { createStyles } from "antd-style"
import { Check, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ token }) => ({
	container: {
		display: "flex",
		alignItems: "center",
		gap: "4px",
		fontSize: "12px",
		color: token.colorTextSecondary,
		marginLeft: "8px",
		transition: "opacity 0.2s ease-in-out",
	},
	saving: {
		color: token.colorPrimary,
	},
	saved: {
		color: token.colorSuccess,
	},
	icon: {
		width: "14px",
		height: "14px",
	},
	spinning: {
		animation: "spin 1s linear infinite",
	},
	"@keyframes spin": {
		from: {
			transform: "rotate(0deg)",
		},
		to: {
			transform: "rotate(360deg)",
		},
	},
}))

interface SaveStatusIndicatorProps {
	/** 是否正在保存 */
	isSaving: boolean
}

export function SaveStatusIndicator(props: SaveStatusIndicatorProps) {
	const { isSaving } = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const [showSaved, setShowSaved] = useState(false)
	const [prevIsSaving, setPrevIsSaving] = useState(false)

	useEffect(() => {
		// 检测从保存中变为非保存中（保存完成）
		if (prevIsSaving && !isSaving) {
			setShowSaved(true)
			// 2秒后隐藏"保存成功"
			const timer = setTimeout(() => {
				setShowSaved(false)
			}, 2000)
			return () => clearTimeout(timer)
		}
		setPrevIsSaving(isSaving)
	}, [isSaving, prevIsSaving])

	// 如果正在保存，显示"正在保存"
	if (isSaving) {
		return (
			<div className={cx(styles.container, styles.saving)}>
				<Loader2 className={cx(styles.icon, styles.spinning)} />
				<span>{t("design.saving")}</span>
			</div>
		)
	}

	// 如果刚保存完成，显示"保存成功"
	if (showSaved) {
		return (
			<div className={cx(styles.container, styles.saved)}>
				<Check className={styles.icon} />
				<span>{t("design.saved")}</span>
			</div>
		)
	}

	// 其他情况不显示
	return null
}
