import { useTranslation } from "react-i18next"
import { Label } from "@/components/shadcn-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { cn } from "@/utils/cn"
import type { SelfMediaExportFormat } from "../utils/exportImageFormat"

type ExportType = "cardsZip" | "longImage"
type SelectedExportType = ExportType | "wechatCoverImage"

const EXPORT_TYPE_OPTIONS: ExportType[] = ["cardsZip", "longImage"]
const EXPORT_FORMAT_OPTIONS: SelfMediaExportFormat[] = ["png", "jpg", "webp"]

export interface ExportCaptureSize {
	width: number
	height: number
}

type ExportOutputSize = ExportCaptureSize & {
	kind: "exact" | "single" | "long" | "varied"
}

interface ExportOptionsSectionsProps {
	isWechatOfficialMode: boolean
	exportType: SelectedExportType
	onExportTypeChange: (value: ExportType) => void
	format: SelfMediaExportFormat
	onFormatChange: (value: SelfMediaExportFormat) => void
	pixelRatio: number
	onPixelRatioChange: (value: number) => void
	isExporting: boolean
	hintW: number
	hintH: number
	selectedCardCount: number
	selectedCardSizes: ExportCaptureSize[]
}

export default function ExportOptionsSections({
	isWechatOfficialMode,
	exportType,
	onExportTypeChange,
	format,
	onFormatChange,
	pixelRatio,
	onPixelRatioChange,
	isExporting,
	hintW,
	hintH,
	selectedCardCount,
	selectedCardSizes,
}: ExportOptionsSectionsProps) {
	const { t } = useTranslation("super")
	const formatLabel = format.toUpperCase()

	const getOutputSize = (ratio: number): ExportOutputSize | null => {
		if (isWechatOfficialMode) {
			return { kind: "exact" as const, width: hintW * ratio, height: hintH * ratio }
		}
		if (selectedCardCount === 0 || selectedCardSizes.length !== selectedCardCount) return null

		const scaledSizes = selectedCardSizes.map((size) => ({
			width: Math.round(size.width * ratio),
			height: Math.round(size.height * ratio),
		}))
		if (exportType === "longImage") {
			return {
				kind: "long" as const,
				width: Math.max(...scaledSizes.map((size) => size.width)),
				height:
					scaledSizes.reduce((sum, size) => sum + size.height, 0) +
					Math.max(scaledSizes.length - 1, 0) * Math.max(1, Math.round(ratio)),
			}
		}

		const first = scaledSizes[0]
		const allSameSize = scaledSizes.every(
			(size) => size.width === first.width && size.height === first.height,
		)
		if (allSameSize) return { kind: "single" as const, ...first }
		return {
			kind: "varied" as const,
			width: Math.max(...scaledSizes.map((size) => size.width)),
			height: Math.max(...scaledSizes.map((size) => size.height)),
		}
	}

	const getOutputSizeLabel = (outputSize: ExportOutputSize | null) => {
		if (!outputSize) return t("detail.selfMedia.export.scaleOutputCalculating")
		const values = { width: outputSize.width, height: outputSize.height }
		switch (outputSize.kind) {
			case "single":
				return t("detail.selfMedia.export.scaleOutputSingleSize", values)
			case "long":
				return t("detail.selfMedia.export.scaleOutputLongSize", values)
			case "varied":
				return t("detail.selfMedia.export.scaleOutputVariedSize", values)
			default:
				return t("detail.selfMedia.export.scaleOutputSize", values)
		}
	}

	return (
		<>
			{!isWechatOfficialMode ? (
				<div
					className="flex shrink-0 flex-col gap-2 px-4 pt-4 sm:px-6"
					data-testid="self-media-export-type-section"
				>
					<Label className="text-xs font-medium text-muted-foreground">
						{t("detail.selfMedia.export.typeLabel")}
					</Label>
					<RadioGroup
						value={exportType}
						onValueChange={(value) => {
							if (EXPORT_TYPE_OPTIONS.includes(value as ExportType)) {
								onExportTypeChange(value as ExportType)
							}
						}}
						className="grid grid-cols-1 gap-2 sm:grid-cols-2"
						data-testid="self-media-export-type-group"
					>
						{EXPORT_TYPE_OPTIONS.map((type) => {
							const id = `self-media-export-type-${type}`
							const checked = exportType === type
							const title =
								type === "cardsZip"
									? t("detail.selfMedia.export.type.cardsZip.title")
									: t("detail.selfMedia.export.type.longImage.title")
							const description =
								type === "cardsZip"
									? t("detail.selfMedia.export.type.cardsZip.description", {
											format: formatLabel,
										})
									: t("detail.selfMedia.export.type.longImage.description", {
											format: formatLabel,
										})
							return (
								<Label
									key={type}
									htmlFor={id}
									data-testid={
										type === "longImage"
											? "self-media-export-type-long-image"
											: "self-media-export-type-cards-zip"
									}
									className={cn(
										"flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 text-sm transition-colors",
										checked &&
											"border-primary bg-primary/5 ring-1 ring-primary/40",
										isExporting && "cursor-not-allowed opacity-60",
									)}
								>
									<RadioGroupItem
										id={id}
										value={type}
										disabled={isExporting}
										className="mt-0.5"
									/>
									<span className="flex min-w-0 flex-col gap-1">
										<span className="font-medium text-foreground">{title}</span>
										<span className="text-xs leading-5 text-muted-foreground">
											{description}
										</span>
									</span>
								</Label>
							)
						})}
					</RadioGroup>
				</div>
			) : null}

			<div
				className="flex w-full shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 pt-3 text-xs font-medium text-muted-foreground sm:px-6"
				data-testid="self-media-export-format-section"
			>
				{t("detail.selfMedia.export.formatLabel")}
				<RadioGroup
					value={format}
					onValueChange={(value) => {
						if (EXPORT_FORMAT_OPTIONS.includes(value as SelfMediaExportFormat)) {
							onFormatChange(value as SelfMediaExportFormat)
						}
					}}
					className="flex shrink-0 flex-wrap justify-end gap-x-4 gap-y-2"
					data-testid="self-media-export-format-group"
				>
					{EXPORT_FORMAT_OPTIONS.map((option) => {
						const id = `self-media-export-format-${option}`
						return (
							<div key={option} className="flex items-center gap-2">
								<RadioGroupItem
									id={id}
									value={option}
									disabled={isExporting}
									data-testid={`self-media-export-format-option-${option}`}
								/>
								<Label htmlFor={id} className="cursor-pointer text-sm uppercase">
									{option}
								</Label>
							</div>
						)
					})}
				</RadioGroup>
			</div>

			<div
				className="flex w-full shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 py-3 text-xs font-medium text-muted-foreground sm:px-6"
				data-testid="self-media-export-scale-section"
			>
				{t("detail.selfMedia.export.scaleLabel")}
				<RadioGroup
					value={String(pixelRatio)}
					onValueChange={(value) => onPixelRatioChange(Number(value))}
					className="flex shrink-0 flex-wrap justify-end gap-x-4 gap-y-2"
					data-testid="self-media-export-scale-group"
				>
					{[1, 2, 4].map((ratio) => {
						const id = `self-media-export-scale-${ratio}x`
						const outputSize = getOutputSize(ratio)
						return (
							<div key={ratio} className="flex items-center gap-2">
								<RadioGroupItem
									id={id}
									value={String(ratio)}
									disabled={isExporting}
									data-testid={`self-media-export-scale-option-${ratio}x`}
								/>
								<Label
									htmlFor={id}
									className="flex cursor-pointer items-center gap-2 text-sm"
								>
									<span>
										{t("detail.selfMedia.export.scaleOption", { ratio })}
									</span>
									<span
										className="text-xs font-normal tabular-nums text-muted-foreground"
										data-testid={`self-media-export-scale-size-${ratio}x`}
									>
										{getOutputSizeLabel(outputSize)}
									</span>
								</Label>
							</div>
						)
					})}
				</RadioGroup>
			</div>
		</>
	)
}
