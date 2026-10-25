import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type {
	DesignColorToken,
	DesignScaleToken,
	DesignStyle,
	DesignTypographyToken,
} from "./catalog"
import CopyFeedbackButton from "./CopyFeedbackButton"
import { copyToClipboard } from "./copyToClipboard"
import DesignStyleSectionHeader from "./DesignStyleSectionHeader"
import {
	cssFontStack,
	fontWeightValue,
	getStyleVisuals,
	previewFontSize,
	tokenText,
} from "./designStyleVisuals"

function cssValue(value: unknown) {
	return typeof value === "string" || typeof value === "number" ? String(value) : undefined
}

function cssLength(value: unknown, fallback = 8, max = 72) {
	const raw = String(value ?? "")
		.trim()
		.toLowerCase()
	const parsed = Number.parseFloat(raw)
	if (!Number.isFinite(parsed)) return `${fallback}px`
	const pixels = raw.endsWith("rem") || raw.endsWith("em") ? parsed * 16 : parsed
	return `${Math.min(max, Math.max(0, pixels))}px`
}

function ColorSwatches({ colors }: { colors: DesignColorToken[] }) {
	const { t } = useTranslation("super")
	const [copiedName, setCopiedName] = useState<string | null>(null)

	useEffect(() => {
		if (!copiedName) return
		const timeout = window.setTimeout(() => setCopiedName(null), 1600)
		return () => window.clearTimeout(timeout)
	}, [copiedName])

	if (colors.length === 0)
		return (
			<div className="rounded-lg bg-muted/50 px-3 py-4 text-xs text-muted-foreground">
				{t("htmlEditor.designStyle.noColorTokens")}
			</div>
		)

	return (
		<div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
			{colors.map((color) => (
				<button
					key={color.name}
					type="button"
					className="group flex min-w-0 items-center gap-2 overflow-hidden border-b border-border/60 bg-background p-1.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					aria-label={t("htmlEditor.designStyle.copyColor", {
						value: tokenText(color.value),
					})}
					onClick={async () => {
						if (await copyToClipboard(tokenText(color.value, "")))
							setCopiedName(color.name)
					}}
				>
					<span
						className="size-9 shrink-0 rounded-md outline outline-1 outline-black/[0.05] dark:outline-white/[0.06]"
						style={{ backgroundColor: cssValue(color.value) }}
					/>
					<span className="min-w-0 flex-1">
						<span className="flex items-center justify-between gap-1">
							<span className="truncate text-xs font-medium text-foreground">
								{color.name}
							</span>
							{copiedName === color.name ? (
								<Check
									className="size-4 shrink-0 text-emerald-600"
									aria-hidden="true"
								/>
							) : (
								<Copy
									className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground"
									aria-hidden="true"
								/>
							)}
						</span>
						<span className="block truncate font-mono text-[11px] text-muted-foreground">
							{copiedName === color.name
								? t("htmlEditor.designStyle.copied")
								: tokenText(color.value)}
						</span>
					</span>
				</button>
			))}
		</div>
	)
}

function TypographySpecimen({ typography }: { typography: DesignTypographyToken[] }) {
	const { t } = useTranslation("super")
	if (typography.length === 0)
		return (
			<div className="rounded-lg bg-muted/50 px-3 py-4 text-xs text-muted-foreground">
				{t("htmlEditor.designStyle.noTypographyTokens")}
			</div>
		)

	return (
		<div className="grid gap-2 lg:grid-cols-2">
			{typography.map((item) => (
				<div
					key={item.name}
					className="min-w-0 border-b border-border/60 bg-background p-3"
				>
					<div className="flex items-center justify-between gap-3">
						<span className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
							{item.name}
						</span>
						<div className="flex shrink-0 items-center gap-2">
							<span className="font-mono text-[11px] text-muted-foreground">
								{tokenText(item.fontSize)} / {tokenText(item.fontWeight)}
							</span>
							<CopyFeedbackButton
								value={tokenText(item.fontFamily, "")}
								label={t("htmlEditor.designStyle.copyFontStack")}
								iconOnly
							/>
						</div>
					</div>
					<div
						className="mt-2 break-words text-foreground"
						style={{
							fontFamily: cssFontStack(item.fontFamily),
							fontSize: `clamp(18px, ${previewFontSize(item.fontSize)}, 30px)`,
							fontWeight: fontWeightValue(item.fontWeight),
							lineHeight: 1.6,
							letterSpacing: cssValue(item.letterSpacing),
						}}
					>
						{t("htmlEditor.designStyle.typographySample")}
					</div>
					<div className="mt-1 break-words text-[11px] text-muted-foreground">
						{tokenText(item.fontFamily)} · {tokenText(item.lineHeight)} ·{" "}
						{tokenText(item.letterSpacing)}
					</div>
				</div>
			))}
		</div>
	)
}

function SpacingRhythm({ items }: { items: DesignScaleToken[] }) {
	const { t } = useTranslation("super")
	if (items.length === 0)
		return (
			<div className="rounded-lg bg-muted/50 px-3 py-4 text-xs text-muted-foreground">
				{t("htmlEditor.designStyle.noSpacingValues")}
			</div>
		)
	return (
		<div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
			{items.map((item) => (
				<div
					key={`spacing-${item.name}`}
					className="flex min-w-0 items-center gap-2 border-b border-border/60 bg-background p-2"
				>
					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between gap-2">
							<span className="truncate font-mono text-xs text-foreground">
								{item.name}
							</span>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground">
								{tokenText(item.value)}
							</span>
						</div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary"
								style={{ width: cssLength(item.value, 4, 72) }}
							/>
						</div>
					</div>
					<div className="shrink-0">
						<CopyFeedbackButton
							value={tokenText(item.value, "")}
							label={t("htmlEditor.designStyle.copyTokenValue")}
							iconOnly
						/>
					</div>
				</div>
			))}
		</div>
	)
}

function ShapeSpecimen({ items }: { items: DesignScaleToken[] }) {
	const { t } = useTranslation("super")
	if (items.length === 0)
		return (
			<div className="rounded-lg bg-muted/50 px-3 py-4 text-xs text-muted-foreground">
				{t("htmlEditor.designStyle.noRadiusValues")}
			</div>
		)
	return (
		<div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
			{items.map((item) => {
				const radius = cssLength(item.value, 8, 999)
				return (
					<div
						key={`rounded-${item.name}`}
						className="flex min-w-0 items-center gap-2 border-b border-border/60 bg-background p-2"
					>
						<div
							className="size-8 shrink-0 border-2 border-primary bg-primary/10"
							style={{ borderRadius: radius }}
						/>
						<div className="min-w-0 flex-1">
							<div className="truncate font-mono text-xs text-foreground">
								{item.name}
							</div>
							<div className="font-mono text-[11px] text-muted-foreground">
								{tokenText(item.value)}
							</div>
						</div>
						<div className="shrink-0">
							<CopyFeedbackButton
								value={tokenText(item.value, "")}
								label={t("htmlEditor.designStyle.copyTokenValue")}
								iconOnly
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}

export default function DesignStyleTokenPreview({ style }: { style: DesignStyle }) {
	const { t } = useTranslation("super")
	const visuals = getStyleVisuals(style)
	const tokenExport = [
		...style.design.colors.map((item) => `--color-${item.name}: ${tokenText(item.value)};`),
		...style.design.typography.map(
			(item) =>
				`--type-${item.name}: ${tokenText(item.fontSize)} ${tokenText(item.fontFamily)};`,
		),
		...style.design.spacing.map((item) => `--space-${item.name}: ${tokenText(item.value)};`),
		...style.design.rounded.map((item) => `--radius-${item.name}: ${tokenText(item.value)};`),
	].join("\n")

	return (
		<div className="space-y-8">
			<section className="space-y-2.5">
				<DesignStyleSectionHeader
					title={t("htmlEditor.designStyle.colorSystem")}
					description={t("htmlEditor.designStyle.colorSystemDescription")}
					testId="design-style-color-header"
					action={
						<div className="flex items-center gap-2">
							<span className="font-mono text-xs text-muted-foreground">
								{t("htmlEditor.designStyle.colorCount", {
									count: style.design.colors.length,
								})}
							</span>
							<CopyFeedbackButton
								value={tokenExport}
								label={t("htmlEditor.designStyle.copyAllTokens")}
							>
								{t("htmlEditor.designStyle.copyAllTokens")}
							</CopyFeedbackButton>
						</div>
					}
				/>
				<ColorSwatches colors={style.design.colors} />
			</section>
			<section className="space-y-2.5">
				<DesignStyleSectionHeader
					title={t("htmlEditor.designStyle.typography")}
					description={t("htmlEditor.designStyle.typographyDescription")}
					testId="design-style-typography-header"
					action={
						<span className="font-mono text-xs text-muted-foreground">
							{t("htmlEditor.designStyle.typographyCount", {
								count: style.design.typography.length,
							})}
						</span>
					}
				/>
				<TypographySpecimen typography={style.design.typography} />
			</section>
			<div className="grid gap-4 lg:grid-cols-2">
				<section className="space-y-2.5">
					<DesignStyleSectionHeader
						title={t("htmlEditor.designStyle.spacing")}
						description={t("htmlEditor.designStyle.spacingAppliedDescription")}
						testId="design-style-spacing-header"
					/>
					<SpacingRhythm items={style.design.spacing} />
				</section>
				<section className="space-y-2.5">
					<DesignStyleSectionHeader
						title={t("htmlEditor.designStyle.shape")}
						description={t("htmlEditor.designStyle.shapeAppliedDescription")}
						testId="design-style-shape-header"
					/>
					<ShapeSpecimen items={style.design.rounded} />
				</section>
			</div>
			<section className="border-b border-border/60 bg-background p-3">
				<div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
					{t("htmlEditor.designStyle.semanticRoles")}
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{[
						[t("htmlEditor.designStyle.pageBackground"), visuals.canvas],
						[t("htmlEditor.designStyle.contentArea"), visuals.surface],
						[t("htmlEditor.designStyle.mainColor"), visuals.primary],
						[t("htmlEditor.designStyle.textColor"), visuals.text],
					].map(([label, color]) => (
						<div key={label} className="flex items-center gap-2  p-2">
							<div
								className="size-7 shrink-0 rounded"
								style={{ backgroundColor: color }}
							/>
							<div className="min-w-0">
								<div className="text-xs font-medium">{label}</div>
								<div className="truncate font-mono text-[11px] text-muted-foreground">
									{color}
								</div>
							</div>
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
