import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import { useStyles } from "./styles"
import { MagicMermaidType } from "./constants"
import type { MagicMermaidProps } from "./types"
import MagicSegmented from "@/opensource/components/base/MagicSegmented"
import MagicCode from "@/opensource/components/base/MagicCode"
import { Mermaid } from "../Mermaid"
import { useMemoizedFn } from "ahooks"
import MermaidRenderService from "@/opensource/services/other/MermaidRenderService"

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
					<Flex className={styles.segmented} gap={4}>
						<MagicSegmented value={type} onChange={setType} options={options} />
					</Flex>
				)}
				<div className={styles.mermaid}>
					<Mermaid
						chart={fixedData}
						config={mermaidConfig}
						onParseError={handleParseError}
						errorRender={
							<span className={styles.error}>{t("chat.mermaid.error")}</span>
						}
						onClick={handleClick}
					/>
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
