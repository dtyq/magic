import type { ReactNode } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { EditableDescriptionList } from "@magic-admin-v2/components/description-list"
import { ImageUploadField } from "@magic-admin-v2/components/image-upload/image-upload-field"
import { Form } from "@magic-admin-v2/components/ui/form"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import type {
	PlatformInfoFormState,
	PlatformLocale,
} from "@magic-admin-v2/features/platform-info/types"
import { Language } from "@magic-admin-v2/i18n/resources"
import {
	formSetValueOptions,
	GLOBAL_SYSTEM_PROMPT_MAX_LENGTH,
	getContentLocaleCompletion,
	localeLabels,
	platformInfoSectionDescriptionKeys,
	platformInfoSectionTitleKeys,
	platformLocales,
	sharedImageFields,
	showsPlatformInfoContentLocale,
	type PlatformInfoSectionId,
} from "@magic-admin-v2/features/platform-info/utils"
import { PlatformInfoContentLanguageBar, PlatformInfoContentSection } from "./platform-info-shared"
import { PlatformInfoFieldControl } from "./platform-info-fields"
import { PlatformInfoWatermarkForm } from "./platform-info-watermark"

type PlatformInfoFormController = UseFormReturn<PlatformInfoFormState>

export function PlatformInfoForm({
	activeSection,
	contentLocale,
	form,
	onContentLocaleChange,
	onImageUploadingChange,
	value,
}: {
	activeSection: PlatformInfoSectionId
	contentLocale: PlatformLocale
	form: PlatformInfoFormController
	onContentLocaleChange: (locale: PlatformLocale) => void
	onImageUploadingChange?: (uploading: boolean) => void
	value: PlatformInfoFormState
}) {
	const { t } = useTranslation()
	const contentCompletion = getContentLocaleCompletion(value, activeSection)
	const errors = form.formState.errors
	const setValue = form.setValue
	const showContentLocale = showsPlatformInfoContentLocale(activeSection)

	return (
		<PlatformInfoContentSection
			title={t(platformInfoSectionTitleKeys[activeSection])}
			description={t(platformInfoSectionDescriptionKeys[activeSection])}
		>
			<Form {...form}>
				<form className="space-y-8 pb-4" onSubmit={(event) => event.preventDefault()}>
					{showContentLocale ? (
						<PlatformInfoContentLanguageBar
							completion={contentCompletion}
							value={contentLocale}
							onValueChange={onContentLocaleChange}
						/>
					) : null}

                    {activeSection === "basic" ? (
						<div className="space-y-8">
							<div className="grid gap-4 sm:grid-cols-2">
								<ImageUploadField
									label={t("platformInfo.field.logoZh")}
									required
									value={value.logo.zh_CN}
									error={errors.logo?.zh_CN?.message}
									onUploaded={(image) =>
										setValue("logo.zh_CN", image.url, formSetValueOptions)
									}
									onUploadingChange={onImageUploadingChange}
								/>
								<ImageUploadField
									label={t("platformInfo.field.logoEn")}
									required
									value={value.logo.en_US}
									error={errors.logo?.en_US?.message}
									onUploaded={(image) =>
										setValue("logo.en_US", image.url, formSetValueOptions)
									}
									onUploadingChange={onImageUploadingChange}
								/>
								{sharedImageFields.map((field) => (
									<ImageUploadField
										key={field.key}
										label={t(field.labelKey)}
										required={field.required}
										value={value[field.key]}
										error={errors[field.key]?.message}
										onUploaded={(image) =>
											setValue(field.key, image.url, formSetValueOptions)
										}
										onUploadingChange={onImageUploadingChange}
									/>
								))}
							</div>

							<EditableDescriptionList
								items={[
									[
										t("platformInfo.field.defaultLanguage"),
										<Select
											value={value.default_language}
											onValueChange={(nextValue) =>
												setValue(
													"default_language",
													nextValue === Language.EnUS
														? Language.EnUS
														: Language.ZhCN,
													formSetValueOptions,
												)
											}
										>
											<SelectTrigger
												className="w-full"
												data-testid="platform-info-select-trigger"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent data-testid="platform-info-select-content">
												{platformLocales.map((locale) => (
													<SelectItem
														data-testid="platform-info-option"
														key={locale}
														value={locale}
													>
														{localeLabels[locale]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>,
										t("platformInfo.fieldDesc.defaultLanguage"),
									],
									[
										t("platformInfo.field.platformNameZh"),
										<PlatformInfoFieldControl
											error={errors.name_i18n?.zh_CN?.message}
										>
											<Input
												data-testid="platform-info-input"
												placeholder={t(
													"platformInfo.placeholder.platformNameZh",
												)}
												value={value.name_i18n.zh_CN}
												onChange={(event) =>
													setValue(
														"name_i18n.zh_CN",
														event.target.value,
														formSetValueOptions,
													)
												}
											/>
										</PlatformInfoFieldControl>,
										t("platformInfo.fieldDesc.platformNameZh"),
									],
									[
										t("platformInfo.field.platformNameEn"),
										<PlatformInfoFieldControl
											error={errors.name_i18n?.en_US?.message}
										>
											<Input
												data-testid="platform-info-input"
												placeholder={t(
													"platformInfo.placeholder.platformNameEn",
												)}
												value={value.name_i18n.en_US}
												onChange={(event) =>
													setValue(
														"name_i18n.en_US",
														event.target.value,
														formSetValueOptions,
													)
												}
											/>
										</PlatformInfoFieldControl>,
										t("platformInfo.fieldDesc.platformNameEn"),
									],
								]}
							/>
						</div>
					) : null}

					{activeSection === "seo" ? (
						<EditableDescriptionList
							items={[
								[
									"Title",
									<Textarea
										data-testid="platform-info-textarea-input"
										placeholder={t("platformInfo.placeholder.seoTitle")}
										value={value.title_i18n[contentLocale]}
										onChange={(event) =>
											setValue(
												`title_i18n.${contentLocale}`,
												event.target.value,
												formSetValueOptions,
											)
										}
									/>,
									t("platformInfo.fieldDesc.seoTitle"),
								],
								[
									"Keywords",
									<Textarea
										data-testid="platform-info-textarea-input"
										placeholder={t("platformInfo.placeholder.seoKeywords")}
										value={value.keywords_i18n[contentLocale]}
										onChange={(event) =>
											setValue(
												`keywords_i18n.${contentLocale}`,
												event.target.value,
												formSetValueOptions,
											)
										}
									/>,
									t("platformInfo.fieldDesc.seoKeywords"),
								],
								[
									"Description",
									<Textarea
										data-testid="platform-info-textarea-input"
										placeholder={t("platformInfo.placeholder.seoDescription")}
										value={value.description_i18n[contentLocale]}
										onChange={(event) =>
											setValue(
												`description_i18n.${contentLocale}`,
												event.target.value,
												formSetValueOptions,
											)
										}
									/>,
									t("platformInfo.fieldDesc.seoDescription"),
								],
							]}
						/>
					) : null}

					{activeSection === "agentPrompt" ? (
						<EditableDescriptionList
							items={[
								[
									t("platformInfo.field.agentRoleName"),
									<PlatformInfoFieldControl
										error={
											errors.agent_role_name_i18n?.[contentLocale]?.message
										}
									>
										<Input
											data-testid="platform-info-input"
											placeholder={t(
												"platformInfo.placeholder.agentRoleName",
											)}
											value={value.agent_role_name_i18n[contentLocale]}
											onChange={(event) =>
												setValue(
													`agent_role_name_i18n.${contentLocale}`,
													event.target.value,
													formSetValueOptions,
												)
											}
										/>
									</PlatformInfoFieldControl>,
									t("platformInfo.fieldDesc.agentRoleName"),
								],
								[
									t("platformInfo.field.agentRoleDescription"),
									<PlatformInfoFieldControl
										error={
											errors.agent_role_description_i18n?.[contentLocale]
												?.message
										}
									>
										<Textarea
											data-testid="platform-info-textarea-input"
											placeholder={t(
												"platformInfo.placeholder.agentRoleDescription",
											)}
											value={value.agent_role_description_i18n[contentLocale]}
											onChange={(event) =>
												setValue(
													`agent_role_description_i18n.${contentLocale}`,
													event.target.value,
													formSetValueOptions,
												)
											}
										/>
									</PlatformInfoFieldControl>,
									t("platformInfo.fieldDesc.agentRoleDescription"),
								],
							]}
						/>
					) : null}
					{activeSection === "globalSystemPrompt" ? (
						<div className="rounded-md border bg-background p-4">
							<PlatformInfoFieldControl error={errors.global_system_prompt?.message}>
								<Textarea
									data-testid="platform-info-textarea-input"
									aria-label={t("platformInfo.field.globalSystemPrompt")}
									className="min-h-48 resize-y"
									maxLength={GLOBAL_SYSTEM_PROMPT_MAX_LENGTH}
									placeholder={t("platformInfo.placeholder.globalSystemPrompt")}
									value={value.global_system_prompt}
									onChange={(event) =>
										setValue(
											"global_system_prompt",
											event.target.value,
											formSetValueOptions,
										)
									}
								/>
								<div className="flex justify-end text-xs text-muted-foreground">
									{t("platformInfo.characterCount", {
										count: value.global_system_prompt.length,
										max: GLOBAL_SYSTEM_PROMPT_MAX_LENGTH,
									})}
								</div>
							</PlatformInfoFieldControl>
						</div>
					) : null}

					{activeSection === "footer" ? (
						<EditableDescriptionList
							items={[
								[
									t("platformInfo.field.copyright"),
									<Textarea
										data-testid="platform-info-textarea-input"
										placeholder={t("platformInfo.placeholder.copyright")}
										value={value.footer.copyright_i18n[contentLocale]}
										onChange={(event) =>
											setValue(
												`footer.copyright_i18n.${contentLocale}`,
												event.target.value,
												formSetValueOptions,
											)
										}
									/>,
									t("platformInfo.fieldDesc.copyright"),
								],
								[
									t("platformInfo.field.filingEnabled"),
									<div className="flex h-9 items-center gap-3">
										<Switch
											data-testid="platform-info-switch"
											checked={value.footer.filing.enabled}
											onCheckedChange={(checked) =>
												setValue(
													"footer.filing.enabled",
													checked,
													formSetValueOptions,
												)
											}
										/>
										<span className="text-sm text-muted-foreground">
											{value.footer.filing.enabled
												? t("common.enabled")
												: t("common.disabled")}
										</span>
									</div>,
									t("platformInfo.fieldDesc.filingEnabled"),
								],
								...(value.footer.filing.enabled
									? ([
											[
												t("platformInfo.field.filingNumber"),
												<PlatformInfoFieldControl
													error={errors.footer?.filing?.number?.message}
												>
													<Input
														data-testid="platform-info-input"
														placeholder={t(
															"platformInfo.placeholder.filingNumber",
														)}
														value={value.footer.filing.number}
														onChange={(event) =>
															setValue(
																"footer.filing.number",
																event.target.value,
																formSetValueOptions,
															)
														}
													/>
												</PlatformInfoFieldControl>,
												t("platformInfo.fieldDesc.filingNumber"),
											],
											[
												t("platformInfo.field.filingLink"),
												<PlatformInfoFieldControl
													error={errors.footer?.filing?.link?.message}
												>
													<Input
														placeholder={t(
															"platformInfo.placeholder.filingLink",
														)}
														value={value.footer.filing.link}
														onChange={(event) =>
															setValue(
																"footer.filing.link",
																event.target.value,
																formSetValueOptions,
															)
														}
													/>
												</PlatformInfoFieldControl>,
												t("platformInfo.fieldDesc.filingLink"),
											],
										] as Array<[string, ReactNode, string?]>)
									: []),
							]}
						/>
					) : null}

					{activeSection === "watermark" ? (
						<PlatformInfoWatermarkForm
							error={errors.watermark?.fields?.message}
							value={value.watermark}
							onChange={(nextValue) =>
								setValue("watermark", nextValue, formSetValueOptions)
							}
						/>
					) : null}
				</form>
			</Form>
		</PlatformInfoContentSection>
	)
}
