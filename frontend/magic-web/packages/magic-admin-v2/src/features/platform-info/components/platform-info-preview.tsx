import { ImageIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DescriptionList } from "@magic-admin-v2/components/description-list"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import type {
	PlatformInfoFormState,
	PlatformLocale,
} from "@magic-admin-v2/features/platform-info/types"
import {
	getContentLocaleCompletion,
	isSafeImageUrl,
	localeLabels,
	platformInfoSectionDescriptionKeys,
	platformInfoSectionTitleKeys,
	sharedImageFields,
	showsPlatformInfoContentLocale,
	type PlatformInfoSectionId,
} from "@magic-admin-v2/features/platform-info/utils"
import { PlatformInfoContentLanguageBar, PlatformInfoContentSection } from "./platform-info-shared"
import { PlatformInfoWatermarkPreview } from "./platform-info-watermark"

export function PlatformInfoPreview({
	activeSection,
	contentLocale,
	onContentLocaleChange,
	value,
}: {
	activeSection: PlatformInfoSectionId
	contentLocale: PlatformLocale
	onContentLocaleChange: (locale: PlatformLocale) => void
	value: PlatformInfoFormState
}) {
	const { t } = useTranslation()
	const contentCompletion = getContentLocaleCompletion(value, activeSection)
	const showContentLocale = showsPlatformInfoContentLocale(activeSection)

	return (
		<PlatformInfoContentSection
			title={t(platformInfoSectionTitleKeys[activeSection])}
			description={t(platformInfoSectionDescriptionKeys[activeSection])}
		>
			<div className="space-y-6">
				{showContentLocale ? (
					<PlatformInfoContentLanguageBar
						completion={contentCompletion}
						value={contentLocale}
						onValueChange={onContentLocaleChange}
					/>
				) : null}

				{activeSection === "basic" ? (
					<div className="space-y-6">
						<div className="grid gap-3 sm:grid-cols-2">
							<ImagePreview
								label={t("platformInfo.field.logoZh")}
								value={value.logo.zh_CN}
							/>
							<ImagePreview
								label={t("platformInfo.field.logoEn")}
								value={value.logo.en_US}
							/>
							{sharedImageFields.map((field) => (
								<ImagePreview
									key={field.key}
									label={t(field.labelKey)}
									value={value[field.key]}
								/>
							))}
						</div>
						<DescriptionList
							items={[
								[
									t("platformInfo.field.defaultLanguage"),
									localeLabels[value.default_language],
								],
								[t("platformInfo.field.platformNameZh"), value.name_i18n.zh_CN],
								[t("platformInfo.field.platformNameEn"), value.name_i18n.en_US],
							]}
						/>
					</div>
				) : null}

				{activeSection === "seo" ? (
					<DescriptionList
						items={[
							["Title", value.title_i18n[contentLocale]],
							["Keywords", value.keywords_i18n[contentLocale]],
							["Description", value.description_i18n[contentLocale]],
						]}
					/>
				) : null}

				{activeSection === "agentPrompt" ? (
					<DescriptionList
						items={[
							[
								t("platformInfo.field.agentRoleName"),
								value.agent_role_name_i18n[contentLocale],
							],
							[
								t("platformInfo.field.agentRoleDescription"),
								value.agent_role_description_i18n[contentLocale],
							],
						]}
					/>
				) : null}

				{activeSection === "globalSystemPrompt" ? (
					<div className="rounded-md border bg-background px-4 py-4">
						<p
							className={
								value.global_system_prompt.trim().length > 0
									? "whitespace-pre-wrap break-words text-sm text-foreground"
									: "text-sm text-muted-foreground"
							}
						>
							{value.global_system_prompt.trim().length > 0
								? value.global_system_prompt
								: t("common.emptyValue")}
						</p>
					</div>
				) : null}
				{activeSection === "footer" ? (
					<DescriptionList
						items={[
							[
								t("platformInfo.field.copyright"),
								value.footer.copyright_i18n[contentLocale],
							],
							[
								t("platformInfo.field.filingEnabled"),
								<Badge
									variant={value.footer.filing.enabled ? "success" : "outline"}
								>
									{value.footer.filing.enabled
										? t("common.enabled")
										: t("common.disabled")}
								</Badge>,
							],
							[t("platformInfo.field.filingNumber"), value.footer.filing.number],
							[t("platformInfo.field.filingLink"), value.footer.filing.link],
						]}
					/>
				) : null}
				{activeSection === "watermark" ? (
					<PlatformInfoWatermarkPreview value={value.watermark} />
				) : null}
			</div>
		</PlatformInfoContentSection>
	)
}

function ImagePreview({ label, value }: { label: string; value: string }) {
	const { t } = useTranslation()

	return (
		<div className="rounded-md border bg-background p-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="truncate text-sm font-medium">{label}</p>
				<Badge variant={value ? "outline" : "warning"}>
					{value ? t("common.configured") : t("common.unconfigured")}
				</Badge>
			</div>
			<div className="flex h-20 items-center justify-center overflow-hidden rounded border bg-muted/30 p-2">
				{isSafeImageUrl(value) ? (
					<img
						alt=""
						className="h-full w-full object-contain"
						draggable={false}
						src={value}
					/>
				) : (
					<ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
				)}
			</div>
		</div>
	)
}
