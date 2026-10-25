import { useMemo, type Dispatch, type SetStateAction } from "react"
import { AlertCircle, Loader2, RotateCcw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/shadcn-ui/accordion"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import type {
	SlidesTemplateCategoryItem,
	SlidesTemplateTagGroupItem,
} from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import { getSlidesTemplateName } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import type {
	SlidesTemplateSettingsFormErrors,
	SlidesTemplateSettingsFormState,
} from "./settingsTypes"
import type { SlidesTemplateManifestSlide } from "./types"

export function SettingsFieldError({ id, message }: { id: string; message?: string }) {
	if (!message) return null
	return (
		<p id={id} className="text-xs text-destructive" role="alert">
			{message}
		</p>
	)
}

interface BasicInfoSectionProps {
	errors: SlidesTemplateSettingsFormErrors
	form: SlidesTemplateSettingsFormState
	setForm: Dispatch<SetStateAction<SlidesTemplateSettingsFormState>>
}

export function SlidesTemplateBasicInfoSection({ errors, form, setForm }: BasicInfoSectionProps) {
	const { t } = useTranslation("super")
	const inputFields = [
		["labelZh", t("slidesTemplatePreview.settings.labelZh")],
		["labelEn", t("slidesTemplatePreview.settings.labelEn")],
	] as const
	const descriptionFields = [
		["descriptionZh", t("slidesTemplatePreview.settings.descriptionZh")],
		["descriptionEn", t("slidesTemplatePreview.settings.descriptionEn")],
	] as const

	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				{inputFields.map(([field, label]) => {
					const errorId = `slides-template-settings-${field}-error`
					return (
						<div key={field} className="space-y-2">
							<Label htmlFor={`slides-template-settings-${field}`}>{label}</Label>
							<Input
								id={`slides-template-settings-${field}`}
								value={form[field]}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										[field]: event.target.value,
									}))
								}
								aria-invalid={Boolean(errors[field])}
								aria-describedby={errors[field] ? errorId : undefined}
							/>
							<SettingsFieldError id={errorId} message={errors[field]} />
						</div>
					)
				})}
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				{descriptionFields.map(([field, label]) => {
					const errorId = `slides-template-settings-${field}-error`
					return (
						<div key={field} className="space-y-2">
							<Label htmlFor={`slides-template-settings-${field}`}>{label}</Label>
							<Textarea
								id={`slides-template-settings-${field}`}
								value={form[field]}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										[field]: event.target.value,
									}))
								}
								aria-invalid={Boolean(errors[field])}
								aria-describedby={errors[field] ? errorId : undefined}
								className="min-h-24 resize-y"
							/>
							<SettingsFieldError id={errorId} message={errors[field]} />
						</div>
					)
				})}
			</div>
		</div>
	)
}

interface TaxonomySectionProps {
	categories: SlidesTemplateCategoryItem[]
	errors: SlidesTemplateSettingsFormErrors
	form: SlidesTemplateSettingsFormState
	isLoading: boolean
	loadFailed: boolean
	onRetry: () => void
	setForm: Dispatch<SetStateAction<SlidesTemplateSettingsFormState>>
	tagGroups: SlidesTemplateTagGroupItem[]
	toggleTag: (code: string, checked: boolean) => void
}

export function SlidesTemplateTaxonomySection({
	categories,
	errors,
	form,
	isLoading,
	loadFailed,
	onRetry,
	setForm,
	tagGroups,
	toggleTag,
}: TaxonomySectionProps) {
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const categoryCodeSet = useMemo(
		() => new Set(categories.map((category) => category.code)),
		[categories],
	)
	const availableTagCodes = useMemo(
		() => new Set(tagGroups.flatMap((group) => group.tags.map((tag) => tag.code))),
		[tagGroups],
	)
	const unavailableTagCodes = form.tagCodes.filter((code) => !availableTagCodes.has(code))
	const isCurrentCategoryUnavailable =
		Boolean(form.categoryCode) && !categoryCodeSet.has(form.categoryCode)

	return (
		<div className="space-y-4">
			{isLoading ? (
				<div className="flex justify-end">
					<Loader2
						className="size-4 animate-spin text-muted-foreground"
						aria-label={t("slidesTemplatePreview.settings.taxonomyLoading")}
					/>
				</div>
			) : null}
			{loadFailed ? (
				<div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						<AlertCircle className="size-4" aria-hidden="true" />
						{t("slidesTemplatePreview.settings.taxonomyLoadFailed")}
					</div>
					<Button type="button" variant="outline" size="sm" onClick={onRetry}>
						<RotateCcw className="mr-1.5 size-4" aria-hidden="true" />
						{t("common.retry")}
					</Button>
				</div>
			) : null}
			<div className="space-y-2">
				<Label htmlFor="slides-template-settings-categoryCode">
					{t("slidesTemplatePreview.settings.category")}
				</Label>
				<Select
					value={form.categoryCode || undefined}
					onValueChange={(value) =>
						setForm((current) => ({ ...current, categoryCode: value }))
					}
				>
					<SelectTrigger
						id="slides-template-settings-categoryCode"
						className="w-full"
						aria-invalid={Boolean(errors.categoryCode)}
						aria-describedby={
							errors.categoryCode
								? "slides-template-settings-categoryCode-error"
								: undefined
						}
					>
						<SelectValue
							placeholder={t("slidesTemplatePreview.settings.selectCategory")}
						/>
					</SelectTrigger>
					<SelectContent>
						{isCurrentCategoryUnavailable ? (
							<SelectItem value={form.categoryCode}>
								{form.categoryCode} ·{" "}
								{t("slidesTemplatePreview.settings.unavailable")}
							</SelectItem>
						) : null}
						{categories.map((category) => (
							<SelectItem key={category.code} value={category.code}>
								{lt(getSlidesTemplateName(category))}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<SettingsFieldError
					id="slides-template-settings-categoryCode-error"
					message={errors.categoryCode}
				/>
			</div>
			<div className="space-y-3">
				<Label id="slides-template-settings-tagCodes" tabIndex={-1}>
					{t("slidesTemplatePreview.settings.tags")}
				</Label>
				{tagGroups.map((group, groupIndex) => (
					<div key={group.code} className="space-y-2 rounded-lg bg-muted/40 p-3">
						<div className="text-xs font-medium text-muted-foreground">
							{lt(getSlidesTemplateName(group))}
						</div>
						<div className="flex flex-wrap gap-2">
							{group.tags.map((tag, tagIndex) => {
								const checked = form.tagCodes.includes(tag.code)
								return (
									<label
										key={tag.code}
										className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-sm"
									>
										<Checkbox
											id={
												groupIndex === 0 && tagIndex === 0
													? "slides-template-settings-tagCodes-control"
													: undefined
											}
											checked={checked}
											onCheckedChange={(value) =>
												toggleTag(tag.code, value === true)
											}
										/>
										<span>{lt(getSlidesTemplateName(tag))}</span>
									</label>
								)
							})}
						</div>
					</div>
				))}
				{unavailableTagCodes.length > 0 ? (
					<div className="space-y-2">
						<div className="text-xs text-muted-foreground">
							{t("slidesTemplatePreview.settings.unavailableTags")}
						</div>
						<div className="flex flex-wrap gap-2">
							{unavailableTagCodes.map((code) => (
								<Badge key={code} variant="secondary" className="gap-1.5">
									{code}
									<button
										type="button"
										className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label={t("slidesTemplatePreview.settings.removeTag", {
											code,
										})}
										onClick={() => toggleTag(code, false)}
									>
										<X className="size-3" aria-hidden="true" />
									</button>
								</Badge>
							))}
						</div>
					</div>
				) : null}
				<SettingsFieldError
					id="slides-template-settings-tagCodes-error"
					message={errors.tagCodes}
				/>
			</div>
		</div>
	)
}

interface SlidesSectionProps {
	errors: SlidesTemplateSettingsFormErrors
	form: SlidesTemplateSettingsFormState
	updateSlide: (index: number, patch: Partial<SlidesTemplateManifestSlide>) => void
}

export function SlidesTemplatePagesSection({ errors, form, updateSlide }: SlidesSectionProps) {
	const { t } = useTranslation("super")

	return (
		<div className="space-y-3">
			<SettingsFieldError
				id="slides-template-settings-slides-error"
				message={errors.slides}
			/>
			<Accordion type="multiple" defaultValue={[]} className="rounded-lg border px-3">
				{form.slides.map((slide, index) => (
					<AccordionItem key={slide.file} value={String(index)}>
						<AccordionTrigger
							id={
								index === 0
									? "slides-template-settings-slide-list-control"
									: undefined
							}
							className="hover:no-underline"
						>
							<span className="flex min-w-0 flex-1 flex-col gap-1 pr-2 text-left sm:grid sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center sm:gap-6">
								<span className="truncate" title={slide.title || slide.file}>
									{index + 1}. {slide.title || slide.file}
								</span>
								<span
									className="truncate text-xs font-normal text-muted-foreground"
									title={slide.description}
								>
									{slide.description}
								</span>
							</span>
						</AccordionTrigger>
						<AccordionContent className="space-y-4">
							<div className="space-y-2">
								<Label>{t("slidesTemplatePreview.settings.slideFile")}</Label>
								<Input
									value={slide.file}
									readOnly
									className="bg-muted/50 text-muted-foreground"
								/>
							</div>
							{(["title", "layout", "description"] as const).map((field) => {
								const fieldKey = `slide-${index}-${field}`
								const errorId = `slides-template-settings-${fieldKey}-error`
								const label =
									field === "title"
										? t("slidesTemplatePreview.settings.slideTitle")
										: field === "layout"
											? t("slidesTemplatePreview.settings.slideLayout")
											: t("slidesTemplatePreview.settings.slideDescription")
								return (
									<div key={field} className="space-y-2">
										<Label htmlFor={`slides-template-settings-${fieldKey}`}>
											{label}
										</Label>
										{field === "description" ? (
											<Textarea
												id={`slides-template-settings-${fieldKey}`}
												value={slide[field]}
												onChange={(event) =>
													updateSlide(index, {
														[field]: event.target.value,
													})
												}
												aria-invalid={Boolean(errors[fieldKey])}
												aria-describedby={
													errors[fieldKey] ? errorId : undefined
												}
											/>
										) : (
											<Input
												id={`slides-template-settings-${fieldKey}`}
												value={slide[field]}
												onChange={(event) =>
													updateSlide(index, {
														[field]: event.target.value,
													})
												}
												aria-invalid={Boolean(errors[fieldKey])}
												aria-describedby={
													errors[fieldKey] ? errorId : undefined
												}
											/>
										)}
										<SettingsFieldError
											id={errorId}
											message={errors[fieldKey]}
										/>
									</div>
								)
							})}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	)
}
