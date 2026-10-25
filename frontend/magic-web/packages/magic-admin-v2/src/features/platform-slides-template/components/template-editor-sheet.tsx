import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, X } from "lucide-react"
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Form } from "@magic-admin-v2/components/ui/form"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@magic-admin-v2/components/ui/sheet"
import { TemplateEditorForm } from "@magic-admin-v2/features/platform-slides-template/components/template-editor-form"
import { TemplateEditorPreview } from "@magic-admin-v2/features/platform-slides-template/components/template-editor-preview"
import { createSlidesTemplateFormSchema } from "@magic-admin-v2/features/platform-slides-template/form-schema"
import { useSlidesTemplateMutations } from "@magic-admin-v2/features/platform-slides-template/mutations"
import {
	useSlidesTemplateCategoriesQuery,
	useSlidesTemplateDetailQuery,
	useSlidesTemplateTagsQuery,
} from "@magic-admin-v2/features/platform-slides-template/queries"
import {
	slidesTemplateStatus,
	type SlidesTemplate,
	type SlidesTemplateFormValues,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	FEATURED_SLIDES_TEMPLATE_TAG_CODE,
	ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY,
	ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY,
	buildSlidesTemplateSaveParams,
	generateSlidesTemplateCode,
	isCodeConflictError,
	joinUploadDirectory,
	resolveSlidesTemplateTitle,
} from "@magic-admin-v2/features/platform-slides-template/utils"
import { useRuntime } from "@magic-admin-v2/runtime/context"

const initialValues: SlidesTemplateFormValues = {
	category_code: "",
	code: "",
	collage_file_key: "",
	collage_url: "",
	description_en: "",
	description_zh: "",
	label_en: "",
	label_zh: "",
	preview_image_file_keys: [],
	preview_image_urls: [],
	preview_url: "",
	sort: 0,
	status: true,
	tag_codes: [],
	template_file_key: "",
	thumbnail_file_key: "",
	thumbnail_url: "",
}

function toFormValues(template?: SlidesTemplate | null): SlidesTemplateFormValues {
	if (!template) return { ...initialValues, code: generateSlidesTemplateCode() }
	return {
		category_code: template.category_code ?? "",
		code: template.code,
		collage_file_key: template.collage_file_key ?? "",
		collage_url: template.collage_url ?? "",
		description_en: template.description?.en_US ?? "",
		description_zh: template.description?.zh_CN ?? "",
		label_en: template.label?.en_US ?? "",
		label_zh: template.label?.zh_CN ?? "",
		preview_image_file_keys: template.preview_image_file_keys ?? [],
		preview_image_urls: template.preview_image_urls ?? [],
		preview_url: template.preview_url ?? "",
		sort: template.sort ?? 0,
		status: template.status === slidesTemplateStatus.enabled,
		tag_codes: template.tags?.map((tag) => tag.code) ?? [],
		template_file_key: template.template_file_key ?? "",
		thumbnail_file_key: template.thumbnail_file_key ?? "",
		thumbnail_url: template.thumbnail_url ?? "",
	}
}

export function TemplateEditorSheet({
	onOpenChange,
	open,
	template,
}: {
	onOpenChange: (open: boolean) => void
	open: boolean
	template: SlidesTemplate | null
}) {
	const { t } = useTranslation()
	const { capabilities } = useRuntime()
	const mutations = useSlidesTemplateMutations()
	const templateId = template?.id ?? null
	const detailQuery = useSlidesTemplateDetailQuery(open ? templateId : null)
	const categoriesQuery = useSlidesTemplateCategoriesQuery(
		ENABLED_SLIDES_TEMPLATE_CATEGORY_OPTIONS_QUERY,
		open,
	)
	const tagsQuery = useSlidesTemplateTagsQuery(ENABLED_SLIDES_TEMPLATE_TAG_OPTIONS_QUERY, open)
	const [uploadCount, setUploadCount] = useState(0)
	const [previewIndex, setPreviewIndex] = useState(0)
	const [hydratedTemplateId, setHydratedTemplateId] = useState<string | null>(null)
	const abortControllers = useRef(new Set<AbortController>())
	const handledDetailErrorAtRef = useRef(0)
	const isSaving = mutations.create.isPending || mutations.update.isPending
	const isBusy = uploadCount > 0 || isSaving
	const isDetailReady = !templateId || hydratedTemplateId === templateId
	const schema = useMemo(() => createSlidesTemplateFormSchema(t), [t])
	const form = useForm<SlidesTemplateFormValues>({
		defaultValues: initialValues,
		resolver: zodResolver(schema),
	})
	const { getValues, handleSubmit, reset, setValue, watch } = form
	const values = watch()

	useEffect(() => {
		if (!open) {
			setHydratedTemplateId(null)
			return
		}
		if (!templateId) {
			reset(toFormValues(null))
			setPreviewIndex(0)
			setHydratedTemplateId(null)
			return
		}
		if (
			!detailQuery.data ||
			detailQuery.isFetching ||
			detailQuery.data.id !== templateId ||
			hydratedTemplateId === templateId
		)
			return
		reset(toFormValues(detailQuery.data))
		setPreviewIndex(0)
		setHydratedTemplateId(templateId)
	}, [detailQuery.data, detailQuery.isFetching, hydratedTemplateId, open, reset, templateId])

	useEffect(() => {
		if (
			!open ||
			!templateId ||
			!detailQuery.isError ||
			detailQuery.isFetching ||
			detailQuery.errorUpdatedAt === handledDetailErrorAtRef.current
		)
			return
		handledDetailErrorAtRef.current = detailQuery.errorUpdatedAt
		toast.error(
			(detailQuery.error as { message?: string } | null)?.message ||
				t("slidesTemplate.messages.detailLoadFailed"),
		)
		onOpenChange(false)
	}, [
		detailQuery.error,
		detailQuery.errorUpdatedAt,
		detailQuery.isError,
		detailQuery.isFetching,
		onOpenChange,
		open,
		t,
		templateId,
	])

	useEffect(
		() => () => {
			abortControllers.current.forEach((controller) => controller.abort())
			abortControllers.current.clear()
		},
		[],
	)

	const availableTags = useMemo(() => tagsQuery.data?.list ?? [], [tagsQuery.data?.list])
	const selectableTags = useMemo(() => {
		const options = new Map(availableTags.map((tag) => [tag.code, tag]))
		detailQuery.data?.tags?.forEach((tag) => {
			if (tag.node_type === "tag" && !options.has(tag.code)) options.set(tag.code, tag)
		})
		return Array.from(options.values())
	}, [availableTags, detailQuery.data?.tags])
	const selectableCategories = useMemo(() => {
		const options = new Map(
			(categoriesQuery.data?.list ?? []).map((category) => [category.code, category]),
		)
		const currentCategory = detailQuery.data?.category
		if (currentCategory && !options.has(currentCategory.code)) {
			options.set(currentCategory.code, currentCategory)
		}
		return Array.from(options.values())
	}, [categoriesQuery.data?.list, detailQuery.data?.category])
	const featuredTag = availableTags.find((tag) => tag.code === FEATURED_SLIDES_TEMPLATE_TAG_CODE)
	const previewUrls =
		values.preview_image_urls.length > 0
			? values.preview_image_urls
			: [values.thumbnail_url, values.collage_url].filter(Boolean)

	const upload = useCallback(
		async (file: File, storage: "private" | "public", previews = false) => {
			const controller = new AbortController()
			abortControllers.current.add(controller)
			setUploadCount((count) => count + 1)
			try {
				return await capabilities.uploadFile(file, {
					directory: joinUploadDirectory(getValues("code"), previews),
					signal: controller.signal,
					storage,
				})
			} finally {
				abortControllers.current.delete(controller)
				setUploadCount((count) => Math.max(0, count - 1))
			}
		},
		[capabilities, getValues],
	)

	const uploadImage = useCallback(
		async (kind: "collage" | "thumbnail", files: File[]) => {
			const file = files[0]
			if (!file) return
			if (!file.type.startsWith("image/")) {
				toast.error(t("slidesTemplate.messages.imageOnly"))
				return
			}
			try {
				const result = await upload(file, "public")
				setValue(`${kind}_file_key`, result.path, {
					shouldDirty: true,
					shouldValidate: true,
				})
				setValue(`${kind}_url`, result.url ?? "", { shouldDirty: true })
			} catch (error) {
				if ((error as Error).name !== "AbortError") toast.error((error as Error).message)
			}
		},
		[setValue, t, upload],
	)

	const uploadPreviews = useCallback(
		async (files: File[]) => {
			const imageFiles = files.filter((file) => file.type.startsWith("image/"))
			if (imageFiles.length === 0)
				return toast.error(t("slidesTemplate.messages.selectImage"))
			const results = await Promise.all(
				imageFiles.map(async (file) => {
					try {
						const result = await upload(file, "public", true)
						return result.url ? { path: result.path, url: result.url } : null
					} catch (error) {
						if ((error as Error).name !== "AbortError")
							toast.error(`${file.name}: ${(error as Error).message}`)
						return null
					}
				}),
			)
			const successful = results.filter((result): result is { path: string; url: string } =>
				Boolean(result),
			)
			if (successful.length > 0) {
				const currentKeys = getValues("preview_image_file_keys")
				const currentUrls = getValues("preview_image_urls")
				setValue(
					"preview_image_file_keys",
					[...currentKeys, ...successful.map((item) => item.path)],
					{ shouldDirty: true },
				)
				setValue(
					"preview_image_urls",
					[...currentUrls, ...successful.map((item) => item.url)],
					{ shouldDirty: true },
				)
			}
		},
		[getValues, setValue, t, upload],
	)

	const uploadZip = useCallback(
		async (files: File[]) => {
			const file = files[0]
			if (!file) return
			if (!file.name.toLowerCase().endsWith(".zip"))
				return toast.error(t("slidesTemplate.form.invalidZip"))
			try {
				const result = await upload(file, "private")
				setValue("template_file_key", result.path, {
					shouldDirty: true,
					shouldValidate: true,
				})
			} catch (error) {
				if ((error as Error).name !== "AbortError") toast.error((error as Error).message)
			}
		},
		[setValue, t, upload],
	)

	const validateAndSave = handleSubmit(async (formValues) => {
		try {
			if (template) {
				await mutations.update.mutateAsync({
					data: buildSlidesTemplateSaveParams(formValues, false),
					id: template.id,
				})
				toast.success(t("slidesTemplate.messages.templateUpdated"))
			} else {
				try {
					await mutations.create.mutateAsync(
						buildSlidesTemplateSaveParams(formValues, true),
					)
				} catch (error) {
					if (!isCodeConflictError(error)) throw error
					const nextCode = generateSlidesTemplateCode()
					setValue("code", nextCode)
					await mutations.create.mutateAsync(
						buildSlidesTemplateSaveParams({ ...formValues, code: nextCode }, true),
					)
				}
				toast.success(t("slidesTemplate.messages.templateCreated"))
			}
			onOpenChange(false)
		} catch (error) {
			toast.error(
				(error as { message?: string }).message || t("slidesTemplate.messages.saveFailed"),
			)
		}
	})

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && isBusy) return
		onOpenChange(nextOpen)
	}

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<Form {...form}>
				<SheetContent data-testid="platform-slides-template-editor-content" closeButtonTestId="platform-slides-template-editor-close-button" className="w-full gap-0 p-0 sm:max-w-[min(1180px,96vw)]">
					<SheetHeader className="border-b px-6 py-5">
						<SheetTitle>
							{template ? t("slidesTemplate.edit") : t("slidesTemplate.add")}
						</SheetTitle>
						<SheetDescription>
							{isDetailReady
								? values.label_zh ||
									values.label_en ||
									t("slidesTemplate.editor.unnamedTemplate")
								: template
									? resolveSlidesTemplateTitle(template)
									: t("slidesTemplate.editor.unnamedTemplate")}{" "}
							· {isDetailReady ? values.code : template?.code}
						</SheetDescription>
					</SheetHeader>
					<div className="relative grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(360px,0.9fr)_minmax(480px,1.1fr)]">
						{!isDetailReady ? <TemplateEditorDetailSkeleton /> : null}
						<TemplateEditorPreview
							isDetailReady={isDetailReady}
							onPreviewImagesChange={(keys, urls) => {
								setValue("preview_image_file_keys", keys, { shouldDirty: true })
								setValue("preview_image_urls", urls, { shouldDirty: true })
								setPreviewIndex(0)
							}}
							onPreviewIndexChange={setPreviewIndex}
							onUploadPreviews={uploadPreviews}
							previewImageFileKeys={values.preview_image_file_keys}
							previewImageUrls={values.preview_image_urls}
							previewIndex={previewIndex}
							previewUrls={previewUrls}
						/>
						<TemplateEditorForm
							categoriesLoading={categoriesQuery.isLoading}
							featuredTag={featuredTag}
							isDetailReady={isDetailReady}
							onSubmit={validateAndSave}
							selectableCategories={selectableCategories}
							selectableTags={selectableTags}
							tagsLoading={tagsQuery.isLoading}
							uploadImage={uploadImage}
							uploadZip={uploadZip}
						/>
					</div>
					<SheetFooter className="flex-row items-center justify-between border-t px-6 py-4">
						<div>
							{uploadCount > 0 ? (
								<Button
									onClick={() =>
										abortControllers.current.forEach((controller) =>
											controller.abort(),
										)
									}
									type="button"
									variant="ghost"
								 data-testid="platform-slides-template-cancel-button">
									<X className="mr-2 size-4" />
									{t("slidesTemplate.editor.cancelUpload", {
										count: uploadCount,
									})}
								</Button>
							) : null}
						</div>
						<div className="flex gap-2">
							<Button
								disabled={isBusy}
								onClick={() => handleOpenChange(false)}
								type="button"
								variant="outline"
							 data-testid="platform-slides-template-cancel-button">
								{t("common.cancel")}
							</Button>
							<Button
								disabled={isBusy || !isDetailReady}
								form="slides-template-form"
								type="submit"
							 data-testid="platform-slides-template-save-button">
								{isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
								{isSaving ? t("common.saving") : t("common.save")}
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Form>
		</Sheet>
	)
}

function TemplateEditorDetailSkeleton() {
	return (
		<div
		className="absolute inset-0 z-20 grid bg-background lg:grid-cols-[minmax(360px,0.9fr)_minmax(480px,1.1fr)]"
		data-testid="platform-slides-template-editor-loading"
	>
			<div className="space-y-4 border-b bg-muted/20 p-6 lg:border-b-0 lg:border-r">
				<Skeleton className="h-5 w-28" />
				<Skeleton className="aspect-video w-full rounded-xl" />
				<div className="flex justify-between">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-24" />
				</div>
				<div className="grid grid-cols-3 gap-2">
					{Array.from({ length: 3 }, (_, index) => (
						<Skeleton className="aspect-video rounded-md" key={index} />
					))}
				</div>
			</div>
			<div className="space-y-8 p-6">
				{Array.from({ length: 3 }, (_, sectionIndex) => (
					<div className="space-y-4" key={sectionIndex}>
						<Skeleton className="h-5 w-24" />
						<div className="grid gap-4 sm:grid-cols-2">
							{Array.from({ length: sectionIndex === 0 ? 4 : 2 }, (_, fieldIndex) => (
								<div className="space-y-2" key={fieldIndex}>
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-10 w-full" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
