import classNames from "classnames"
import styles from "./index.module.css"

interface SizeIconPreviewProps {
	/** 图标宽度（像素） */
	iconWidth: number
	/** 图标高度（像素） */
	iconHeight: number
	/** 外层容器宽度（像素），如果提供则覆盖默认值 */
	wrapperWidth?: number
	/** 外层容器高度（像素），如果提供则覆盖默认值 */
	wrapperHeight?: number
	/** 自定义外层容器类名 */
	wrapperClassName?: string
	/** 自定义内层图标类名 */
	iconClassName?: string
}

export default function SizeIconPreview({
	iconWidth,
	iconHeight,
	wrapperWidth,
	wrapperHeight,
	wrapperClassName,
	iconClassName,
}: SizeIconPreviewProps) {
	const wrapperStyle: React.CSSProperties = {}
	if (wrapperWidth !== undefined) {
		wrapperStyle.width = `${wrapperWidth}px`
	}
	if (wrapperHeight !== undefined) {
		wrapperStyle.height = `${wrapperHeight}px`
	}

	return (
		<div className={classNames(styles.iconWrapper, wrapperClassName)} style={wrapperStyle}>
			<div
				className={classNames(styles.icon, iconClassName)}
				style={{
					width: `${iconWidth}px`,
					height: `${iconHeight}px`,
				}}
			/>
		</div>
	)
}
