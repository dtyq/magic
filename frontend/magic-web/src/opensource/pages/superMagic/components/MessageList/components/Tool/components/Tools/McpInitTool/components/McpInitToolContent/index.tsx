import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"

// Types
import type { McpInitToolContentProps, ServerResult } from "./types"

// Styles
import { useStyles } from "./styles"

/**
 * McpInitToolContent - MCP初始化工具详情展示组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const McpInitToolContent = memo(({ detail, className }: McpInitToolContentProps) => {
	const { t } = useTranslation("component")
	const { styles, cx } = useStyles()

	// 分离成功和失败的服务器结果
	const { successResults, failedResults } = useMemo(() => {
		const serverResults = detail?.server_results || []
		const successResults = serverResults.filter(
			(result: ServerResult) => result.status === "success",
		)
		const failedResults = serverResults.filter(
			(result: ServerResult) => result.status === "failed",
		)

		return {
			successResults,
			failedResults,
		}
	}, [detail])

	// 渲染结果项
	const renderResultItems = (results: ServerResult[]) => {
		return results.map((result, index) => (
			<div key={index} className={styles.resultItem}>
				{result?.label_name || result?.name}
			</div>
		))
	}

	return (
		<div className={cx(styles.container, className)}>
			{/* 初始化成功部分 */}
			{successResults.length > 0 && (
				<div className={styles.section}>
					<div className={styles.sectionHeader}>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect width="14" height="14" rx="7" fill="#32C436" />
							<g clipPath="url(#clip0_36587_228157)">
								<path
									d="M4.0835 6.99996L6.16683 9.08329L10.3335 4.91663"
									stroke="white"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</g>
							<defs>
								<clipPath id="clip0_36587_228157">
									<rect
										width="10"
										height="10"
										fill="white"
										transform="translate(2 2)"
									/>
								</clipPath>
							</defs>
						</svg>

						<span className={styles.sectionTitle}>{t("mcpInitTool.initSuccess")}</span>
						<span className={styles.sectionCount}>
							{successResults.length} {t("mcpInitTool.countUnit")}
						</span>
					</div>
					<div className={styles.contentArea}>{renderResultItems(successResults)}</div>
				</div>
			)}

			{/* 初始化失败部分 */}
			{failedResults.length > 0 && (
				<div className={styles.section}>
					<div className={styles.sectionHeader}>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect width="14" height="14" rx="7" fill="#FF4D3A" />
							<path
								d="M9.5 4.5L4.5 9.5"
								stroke="white"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<path
								d="M4.5 4.5L9.5 9.5"
								stroke="white"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>

						<span className={styles.sectionTitle}>{t("mcpInitTool.initFailed")}</span>
						<span className={styles.sectionCount}>
							{failedResults.length} {t("mcpInitTool.countUnit")}
						</span>
					</div>
					<div className={styles.contentArea}>{renderResultItems(failedResults)}</div>
				</div>
			)}
		</div>
	)
})

McpInitToolContent.displayName = "McpInitToolContent"

export default McpInitToolContent
