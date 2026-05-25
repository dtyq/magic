import { memo, useMemo, useState, lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { Flex, Spin } from "antd"
import { useStyles } from "./styles"
import { MagicMermaidType } from "./constants"
import type { MagicMermaidProps } from "./types"
import MagicSegmented from "@/components/base/MagicSegmented"
import MagicCode from "@/components/base/MagicCode"
import MagicImagePreview from "@/components/base/MagicImagePreview"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/shadcn-ui/context-menu"
import { useMemoizedFn } from "ahooks"
import MermaidRenderService from "@/services/other/MermaidRenderService"
import { exportMermaidSvgToPngBlob } from "@/utils/mermaidExport"
import { downloadBlobFile } from "@/utils/file"
import { clipboard } from "@/utils/clipboard-helpers"
import magicToast from "@/components/base/MagicToaster/utils"

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
		allowPreview = false,
		allowShowCode = true,
		copyText,
		...props
	}: MagicMermaidProps) {
		const { t } = useTranslation("interface")

		const options = useMemo(
			() => [
				{
					label: t("interface:chat.markdown.graph"),
					value: MagicMermaidType.Mermaid,
				},
				{
					label: t("interface:chat.markdown.raw"),
					value: MagicMermaidType.Code,
				},
			],
			[t],
		)

		const [type, setType] = useState<MagicMermaidType>(options[0].value)
		const [previewSvg, setPreviewSvg] = useState<string>()
		const { styles, cx } = useStyles({ type })
		const mermaidFileBaseName = t("imagePreview.mermaid.fileName", {
			ns: "interface",
			defaultValue: "mermaid-diagram",
		})

		const getMermaidFileName = useMemoizedFn((extension: "svg" | "png") => {
			const suffix = `.${extension}`
			return mermaidFileBaseName.endsWith(suffix)
				? mermaidFileBaseName
				: `${mermaidFileBaseName}${suffix}`
		})

		const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
			const svg = e.currentTarget
			if (!svg) {
				return
			}

			if (onClick) {
				onClick(svg)
				return
			}

			if (allowPreview) {
				const svgMarkup = svg.innerHTML.trim()
				if (svgMarkup) {
					setPreviewSvg(svgMarkup)
				}
			}
		})

		const closePreview = useMemoizedFn(() => {
			setPreviewSvg(undefined)
		})

		const handleCopySvg = useMemoizedFn(async () => {
			if (!previewSvg) return

			try {
				await clipboard.writeText(previewSvg)
				magicToast.success(t("copy.success", { ns: "message" }))
			} catch {
				magicToast.error(t("copy.failed", { ns: "message" }))
			}
		})

		const handleDownloadSvg = useMemoizedFn(async () => {
			if (!previewSvg) return

			const svgBlob = new Blob([previewSvg], {
				type: "image/svg+xml;charset=utf-8",
			})
			const result = await downloadBlobFile(svgBlob, getMermaidFileName("svg"))

			if (!result.success) {
				magicToast.error(result.message || t("DownloadFailed", { ns: "message" }))
			}
		})

		const handleDownloadPng = useMemoizedFn(async () => {
			if (!previewSvg) return

			try {
				const pngBlob = await exportMermaidSvgToPngBlob(previewSvg)
				const result = await downloadBlobFile(pngBlob, getMermaidFileName("png"))

				if (!result.success) {
					magicToast.error(result.message || t("DownloadFailed", { ns: "message" }))
				}
			} catch {
				magicToast.error(t("DownloadFailed", { ns: "message" }))
			}
		})

		const handleParseError = useMemoizedFn(() => {
			setType(MagicMermaidType.Code)
		})

		const fixedData = useMemo(() => {
			return MermaidRenderService.fix(data)
		}, [data])

		return (
			<>
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
								className={
									allowPreview || onClick ? styles.mermaidInnerWrapper : undefined
								}
							/>
						</Suspense>
					</div>
					<MagicCode className={styles.code} data={fixedData} copyText={copyText} />
				</div>
				<Dialog open={!!previewSvg} onOpenChange={(open) => !open && closePreview()}>
					<DialogContent className="grid h-[80vh] max-h-[80vh] !max-w-[90vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
						<DialogHeader className="shrink-0 border-b border-border px-3 py-3">
							<DialogTitle className="text-base font-semibold">
								{t("interface:chat.markdown.graph")}
							</DialogTitle>
						</DialogHeader>
						<ContextMenu>
							<ContextMenuTrigger asChild>
								<div className={styles.previewCanvas}>
									<MagicImagePreview rootClassName={styles.previewRoot}>
										<div
											className={styles.previewSvg}
											dangerouslySetInnerHTML={{ __html: previewSvg || "" }}
										/>
									</MagicImagePreview>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem onSelect={handleCopySvg}>
									{t("chat.imagePreview.mermaid.copySvg")}
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onSelect={handleDownloadSvg}>
									{t("chat.imagePreview.mermaid.downloadSvg")}
								</ContextMenuItem>
								<ContextMenuItem onSelect={handleDownloadPng}>
									{t("chat.imagePreview.mermaid.downloadPng")}
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onSelect={closePreview}>
									{t("button.close")}
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					</DialogContent>
				</Dialog>
			</>
		)
	},
	(prevProps, nextProps) => {
		return prevProps.data === nextProps.data
	},
)

export default MagicMermaid
