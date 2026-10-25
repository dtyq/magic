import { ArrowLeft, FileText, Palette, Layout } from "lucide-react"
import type { Ref } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type { DesignStyle } from "./catalog"
import { getStyleProfile } from "./styleProfiles"

export type DesignStyleDetailMode = "details" | "rules" | "raw"

interface DesignStyleDetailHeaderProps {
	style: DesignStyle
	mode: DesignStyleDetailMode
	onModeChange: (mode: DesignStyleDetailMode) => void
	onBack: () => void
	backButtonRef?: Ref<HTMLButtonElement>
}

export default function DesignStyleDetailHeader({
	style,
	mode,
	onModeChange,
	onBack,
	backButtonRef,
}: DesignStyleDetailHeaderProps) {
	const { t, i18n } = useTranslation("super")
	const profile = getStyleProfile(style.code)
	const language = (i18n.resolvedLanguage || i18n.language || "en").startsWith("zh") ? "zh" : "en"
	const name = profile?.name[language] ?? style.title
	const description = profile?.description[language] ?? style.description

	return (
		<div
			className="flex flex-wrap items-center justify-between gap-3"
			data-testid="design-style-detail-header"
		>
			<div className="min-w-0 max-w-3xl">
				<div className="flex min-w-0 items-center gap-2">
					<Button
						ref={backButtonRef}
						variant="ghost"
						size="icon"
						className="size-8 shrink-0 rounded-lg"
						onClick={onBack}
						aria-label={t("htmlEditor.designStyle.gallery.back")}
						data-testid="design-style-back"
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
					</Button>
					{/* MagicModal has no Radix Dialog context; keep this shared header context-free. */}
					<h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground [text-wrap:balance]">
						{name}
					</h2>
				</div>
				<p className="mt-1 max-w-[72ch] text-xs leading-5 text-muted-foreground [text-wrap:pretty]">
					{description}
				</p>
			</div>
			<div
				className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-1"
				role="group"
				aria-label={t("htmlEditor.designStyle.detailSectionsLabel")}
			>
				{[
					{
						value: "details" as const,
						label: t("htmlEditor.designStyle.pagePreview"),
						Icon: Layout,
					},
					{
						value: "rules" as const,
						label: t("htmlEditor.designStyle.tokenDetails"),
						Icon: Palette,
					},
					{
						value: "raw" as const,
						label: t("htmlEditor.designStyle.rawMode"),
						Icon: FileText,
					},
				].map(({ value, label, Icon }) => (
					<button
						key={value}
						type="button"
						aria-pressed={mode === value}
						className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0 py-2 text-xs font-medium transition-[color,background-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${mode === value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
						onClick={() => onModeChange(value)}
					>
						<Icon
							className="size-4"
							strokeWidth={mode === value ? 2 : 1.5}
							aria-hidden="true"
						/>
						{label}
					</button>
				))}
			</div>
		</div>
	)
}
