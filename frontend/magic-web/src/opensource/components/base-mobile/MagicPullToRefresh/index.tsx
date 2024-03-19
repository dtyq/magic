import { useCallback } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { PullToRefresh } from "antd-mobile"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import type { MagicPullToRefreshProps } from "./types"

/**
 * MagicPullToRefresh - 移动端下拉刷新组件
 *
 * 基于 Ant Design Mobile 的 PullToRefresh 封装，提供统一的下拉刷新体验
 *
 * @example
 * ```tsx
 * <MagicPullToRefresh
 *   onRefresh={async () => {
 *     await fetchData()
 *   }}
 *   height={600}
 *   successText="刷新成功"
 * >
 *   <YourContent />
 * </MagicPullToRefresh>
 * ```
 */
function MagicPullToRefresh(props: MagicPullToRefreshProps) {
	const {
		onRefresh,
		children,
		height,
		containerStyle,
		containerClassName,
		successText,
		showSuccessMessage = true,
		onRefreshSuccess,
		onRefreshError,
		...restProps
	} = props

	const { t } = useTranslation("super")
	const { styles, cx } = useStyles({ height })

	const handleRefresh = useCallback(async () => {
		try {
			await onRefresh()

			// 刷新成功回调
			onRefreshSuccess?.()

			// 显示成功提示
			if (showSuccessMessage) {
				const text = successText || t("common.refreshSuccess")
				magicToast.success(text)
			}
		} catch (error) {
			// 刷新失败回调
			onRefreshError?.(error as Error)

			// 显示错误提示
			magicToast.error(t("common.refreshFailed"))
			console.error("MagicPullToRefresh refresh error:", error)
		}
	}, [onRefresh, onRefreshSuccess, onRefreshError, showSuccessMessage, successText, t])

	return (
		<div className={cx(styles.container, containerClassName)} style={containerStyle}>
			<PullToRefresh
				onRefresh={handleRefresh}
				threshold={restProps.threshold ?? 90}
				{...restProps}
			>
				{children}
			</PullToRefresh>
		</div>
	)
}

export default MagicPullToRefresh
export type { MagicPullToRefreshProps }
