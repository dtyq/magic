import { useEffect, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/shadcn-ui/accordion"
import type {
	SlidesTemplateCategoryItem,
	SlidesTemplateTagGroupItem,
} from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import {
	SlidesTemplateBasicInfoSection,
	SlidesTemplatePagesSection,
	SlidesTemplateTaxonomySection,
} from "./SlidesTemplateSettingsSections"
import type {
	SlidesTemplateSettingsFormErrors,
	SlidesTemplateSettingsFormState,
} from "./settingsTypes"
import type { SlidesTemplateManifest, SlidesTemplateManifestSlide } from "./types"

interface SlidesTemplateSettingsDialogProps {
	manifest: SlidesTemplateManifest
	onOpenChange: (open: boolean) => void
	onSave: (manifest: SlidesTemplateManifest) => Promise<void>
	open: boolean
}

const LAYOUT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function manifestToForm(manifest: SlidesTemplateManifest): SlidesTemplateSettingsFormState {
	return {
		categoryCode: manifest.category_code ?? "",
		descriptionEn: manifest.description?.en_US ?? "",
		descriptionZh: manifest.description?.zh_CN ?? "",
		labelEn: manifest.label?.en_US ?? "",
		labelZh: manifest.label?.zh_CN ?? "",
		slides: manifest.slides.map((slide) => ({ ...slide })),
		tagCodes: [...(manifest.tag_codes ?? [])],
	}
}

export default function SlidesTemplateSettingsDialog({
	manifest,
	onOpenChange,
	onSave,
	open,
}: SlidesTemplateSettingsDialogProps) {
	const { t } = useTranslation("super")
	const [form, setForm] = useState(() => manifestToForm(manifest))
	const [openSections, setOpenSections] = useState<string[]>(["basic"])
	const [errors, setErrors] = useState<SlidesTemplateSettingsFormErrors>({})
	const [categories, setCategories] = useState<SlidesTemplateCategoryItem[]>([])
	const [tagGroups, setTagGroups] = useState<SlidesTemplateTagGroupItem[]>([])
	const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(false)
	const [taxonomyLoadFailed, setTaxonomyLoadFailed] = useState(false)
	const [taxonomyRevision, setTaxonomyRevision] = useState(0)
	const [isSaving, setIsSaving] = useState(false)
	const [submitError, setSubmitError] = useState("")

	useEffect(() => {
		if (!open) return
		setForm(manifestToForm(manifest))
		setOpenSections(["basic"])
		setErrors({})
		setSubmitError("")
	}, [manifest, open])

	useEffect(() => {
		if (!open) return
		let cancelled = false
		setIsTaxonomyLoading(true)
		setTaxonomyLoadFailed(false)

		Promise.all([
			SuperMagicApi.getSlidesTemplateCategories({ page: 1, page_size: 200 }),
			SuperMagicApi.getSlidesTemplateTagGroups(
				form.categoryCode ? { category_code: form.categoryCode } : {},
			),
		])
			.then(([categoryResponse, tagResponse]) => {
				if (cancelled) return
				setCategories(categoryResponse.list ?? [])
				setTagGroups(tagResponse ?? [])
			})
			.catch((error) => {
				if (cancelled) return
				console.error("Failed to load slides template taxonomy", error)
				setTaxonomyLoadFailed(true)
			})
			.finally(() => {
				if (!cancelled) setIsTaxonomyLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [form.categoryCode, open, taxonomyRevision])

	function updateSlide(index: number, patch: Partial<SlidesTemplateManifestSlide>) {
		setForm((current) => ({
			...current,
			slides: current.slides.map((slide, slideIndex) =>
				slideIndex === index ? { ...slide, ...patch } : slide,
			),
		}))
	}

	function toggleTag(code: string, checked: boolean) {
		setForm((current) => ({
			...current,
			tagCodes: checked
				? current.tagCodes.includes(code)
					? current.tagCodes
					: [...current.tagCodes, code]
				: current.tagCodes.filter((item) => item !== code),
		}))
	}

	function validate(): SlidesTemplateSettingsFormErrors {
		const nextErrors: SlidesTemplateSettingsFormErrors = {}
		const required = t("slidesTemplatePreview.settings.required")
		if (!form.labelZh.trim()) nextErrors.labelZh = required
		if (!form.labelEn.trim()) nextErrors.labelEn = required
		if (!form.descriptionZh.trim()) nextErrors.descriptionZh = required
		if (!form.descriptionEn.trim()) nextErrors.descriptionEn = required
		if (!form.categoryCode.trim()) nextErrors.categoryCode = required
		if (form.tagCodes.length === 0) {
			nextErrors.tagCodes = t("slidesTemplatePreview.settings.tagRequired")
		}
		if (new Set(form.tagCodes).size !== form.tagCodes.length) {
			nextErrors.tagCodes = t("slidesTemplatePreview.settings.tagDuplicate")
		}
		if (form.slides.length === 0) {
			nextErrors.slides = t("slidesTemplatePreview.settings.slideRequired")
		}

		form.slides.forEach((slide, index) => {
			if (!slide.title.trim()) nextErrors[`slide-${index}-title`] = required
			if (!slide.description.trim()) nextErrors[`slide-${index}-description`] = required
			if (!LAYOUT_PATTERN.test(slide.layout.trim())) {
				nextErrors[`slide-${index}-layout`] = t(
					"slidesTemplatePreview.settings.layoutInvalid",
				)
			}
		})
		return nextErrors
	}

	async function handleSubmit() {
		const nextErrors = validate()
		setErrors(nextErrors)
		setSubmitError("")
		const firstErrorKey = Object.keys(nextErrors)[0]
		if (firstErrorKey) {
			if (firstErrorKey === "categoryCode" || firstErrorKey === "tagCodes") {
				setOpenSections((current) =>
					current.includes("taxonomy") ? current : [...current, "taxonomy"],
				)
			}
			if (firstErrorKey === "slides" || firstErrorKey.startsWith("slide-")) {
				setOpenSections((current) =>
					current.includes("slides") ? current : [...current, "slides"],
				)
			}
			const focusId =
				firstErrorKey === "tagCodes"
					? "slides-template-settings-tagCodes-control"
					: firstErrorKey === "slides"
						? "slides-template-settings-slides-control"
						: firstErrorKey.startsWith("slide-")
							? "slides-template-settings-slide-list-control"
							: `slides-template-settings-${firstErrorKey}`
			window.requestAnimationFrame(() => {
				document.getElementById(focusId)?.focus()
			})
			return
		}

		const nextManifest: SlidesTemplateManifest = {
			...manifest,
			category_code: form.categoryCode.trim(),
			tag_codes: [...form.tagCodes],
			label: {
				...manifest.label,
				zh_CN: form.labelZh.trim(),
				en_US: form.labelEn.trim(),
			},
			description: {
				...manifest.description,
				zh_CN: form.descriptionZh.trim(),
				en_US: form.descriptionEn.trim(),
			},
			slides: form.slides.map((slide) => ({
				...slide,
				title: slide.title.trim(),
				layout: slide.layout.trim(),
				description: slide.description.trim(),
			})),
		}

		setIsSaving(true)
		try {
			await onSave(nextManifest)
			onOpenChange(false)
		} catch {
			setSubmitError(t("slidesTemplatePreview.settings.saveFailed"))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
			<DialogContent
				className="flex h-auto max-h-[min(90dvh,860px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[1040px]"
				showCloseButton={false}
				data-testid="slides-template-settings-dialog"
			>
				<DialogHeader className="relative shrink-0 border-b px-4 py-3 pr-12 text-left">
					<DialogTitle className="text-base font-semibold">
						{t("slidesTemplatePreview.settings.title")}
					</DialogTitle>
					<DialogDescription>
						{t("slidesTemplatePreview.settings.description")}
					</DialogDescription>
					<DialogClose asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-3 top-3 size-9 rounded-lg"
							aria-label={t("common.close")}
							disabled={isSaving}
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					</DialogClose>
				</DialogHeader>
				<div
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
					data-testid="slides-template-settings-scroll-area"
				>
					<div
						className="px-3 pb-2 pt-3 sm:px-5 sm:pt-5"
						data-testid="slides-template-settings-content"
					>
						<Accordion
							type="multiple"
							value={openSections}
							onValueChange={setOpenSections}
							className="space-y-2"
						>
							<AccordionItem value="basic" className="rounded-xl border px-4">
								<AccordionTrigger className="py-4 hover:no-underline">
									<div className="min-w-0 text-left">
										<div className="text-sm font-semibold">
											{t("slidesTemplatePreview.settings.basicInfo")}
										</div>
										<div className="mt-1 text-xs font-normal text-muted-foreground">
											{t("slidesTemplatePreview.settings.basicInfoSummary")}
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pb-5">
									<SlidesTemplateBasicInfoSection
										errors={errors}
										form={form}
										setForm={setForm}
									/>
								</AccordionContent>
							</AccordionItem>
							<AccordionItem value="taxonomy" className="rounded-xl border px-4">
								<AccordionTrigger className="py-4 hover:no-underline">
									<div className="min-w-0 text-left">
										<div className="text-sm font-semibold">
											{t("slidesTemplatePreview.settings.taxonomy")}
										</div>
										<div className="mt-1 text-xs font-normal text-muted-foreground">
											{t("slidesTemplatePreview.settings.taxonomySummary")}
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pb-5">
									<SlidesTemplateTaxonomySection
										categories={categories}
										errors={errors}
										form={form}
										isLoading={isTaxonomyLoading}
										loadFailed={taxonomyLoadFailed}
										onRetry={() => setTaxonomyRevision((value) => value + 1)}
										setForm={setForm}
										tagGroups={tagGroups}
										toggleTag={toggleTag}
									/>
								</AccordionContent>
							</AccordionItem>
							<AccordionItem value="slides" className="rounded-xl border px-4">
								<AccordionTrigger
									id="slides-template-settings-slides-control"
									className="py-4 hover:no-underline"
								>
									<div className="min-w-0 text-left">
										<div className="text-sm font-semibold">
											{t("slidesTemplatePreview.settings.slides")}
										</div>
										<div className="mt-1 text-xs font-normal text-muted-foreground">
											{t("slidesTemplatePreview.settings.slidesSummary", {
												count: form.slides.length,
											})}
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pb-5">
									<SlidesTemplatePagesSection
										errors={errors}
										form={form}
										updateSlide={updateSlide}
									/>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</div>
				</div>
				<DialogFooter className="shrink-0 border-t px-4 py-3">
					{submitError ? (
						<p className="mr-auto self-center text-sm text-destructive" role="alert">
							{submitError}
						</p>
					) : null}
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="button"
						onClick={() => void handleSubmit()}
						disabled={isSaving}
						data-testid="slides-template-settings-save-button"
					>
						{isSaving ? (
							<Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
						) : null}
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
