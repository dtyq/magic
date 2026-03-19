import { memo, useMemo, useState, lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { Flex, Spin } from "antd"
import { useStyles } from "./styles"
import { MagicMermaidType } from "./constants"
import type { MagicMermaidProps } from "./types"
import MagicSegmented from "@/components/base/MagicSegmented"
import MagicCode from "@/components/base/MagicCode"
import { useMemoizedFn } from "ahooks"
import MermaidRenderService from "@/services/other/MermaidRenderService"

// Lazy load Mermaid component for better performance
const Mermaid = lazy(() => import("../Mermaid").then((module) => ({ default: module.Mermaid })))

const mermaidConfig = {
	mermaid: {
		suppressErrorRendering: true,
	},
}

const MagicMermaid = memo(
	function MagicMermaid({
		data,
		className,
		onClick,
		allowShowCode = true,
		copyText,
		...props
	}: MagicMermaidProps) {
		const { t } = useTranslation("interface")

		const options = useMemo(
			() => [
				{
					label: t("chat.markdown.graph"),
					value: MagicMermaidType.Mermaid,
				},
				{
					label: t("chat.markdown.raw"),
					value: MagicMermaidType.Code,
				},
			],
			[t],
		)

		const [type, setType] = useState<MagicMermaidType>(options[0].value)
		const { styles, cx } = useStyles({ type })

		const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
			const svg = e.currentTarget
			if (svg) {
				onClick?.(svg)
			}
		})

		const handleParseError = useMemoizedFn(() => {
			setType(MagicMermaidType.Code)
		})

		const fixedData = useMemo(() => {
			return MermaidRenderService.fix(data)
		}, [data])

		return (
			<div
				className={cx(styles.container, className)}
				onClick={(e) => e.stopPropagation()}
				{...props}
			>
				{allowShowCode && (
					<Flex className={cx(styles.segmented, "mode-switch")} gap={4}>
						<MagicSegmented value={type} onChange={setType} options={options} />
					</Flex>
				)}
				<div className={styles.mermaid}>
					<Suspense
						fallback={
							<Flex justify="center" align="center" style={{ minHeight: 100 }}>
								<Spin size="small" />
							</Flex>
						}
					>
						<Mermaid
							chart={fixedData}
							config={mermaidConfig}
							onParseError={handleParseError}
							errorRender={
								<span className={styles.error}>{t("chat.mermaid.error")}</span>
							}
							onClick={handleClick}
						/>
					</Suspense>
				</div>
				<MagicCode className={styles.code} data={fixedData} copyText={copyText} />
			</div>
		)
	},
	(prevProps, nextProps) => {
		return prevProps.data === nextProps.data
	},
)

export default MagicMermaid
