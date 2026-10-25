import { FileArchive, ImagePlus } from "lucide-react"
import {
	forwardRef,
	useEffect,
	useRef,
	useState,
	type ComponentPropsWithoutRef,
	type FormEventHandler,
	type ReactNode,
} from "react"
import { useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@magic-admin-v2/components/ui/form"
import { Input } from "@magic-admin-v2/components/ui/input"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import { SearchableCategorySelect } from "@magic-admin-v2/features/platform-slides-template/components/searchable-category-select"
import { SearchableTagSelect } from "@magic-admin-v2/features/platform-slides-template/components/searchable-tag-select"
import { TemplateEditorUploadField } from "@magic-admin-v2/features/platform-slides-template/components/template-editor-upload-field"
import {
	slidesTemplateStatus,
	type SlidesTemplateCategory,
	type SlidesTemplateFormValues,
	type SlidesTemplateTag,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	FEATURED_SLIDES_TEMPLATE_TAG_CODE,
	SLIDES_TEMPLATE_FIELD_LIMITS,
	setTagEnabled,
} from "@magic-admin-v2/features/platform-slides-template/utils"

type TemplateEditorFormProps = {
	categoriesLoading: boolean
	featuredTag?: SlidesTemplateTag
	isDetailReady: boolean
	onSubmit: FormEventHandler<HTMLFormElement>
	selectableCategories: SlidesTemplateCategory[]
	selectableTags: SlidesTemplateTag[]
	tagsLoading: boolean
	uploadImage: (kind: "collage" | "thumbnail", files: File[]) => void
	uploadZip: (files: File[]) => void
}

/** 模板编辑器右侧表单，表单状态和保存逻辑由页面入口统一管理。 */
export function TemplateEditorForm({
	categoriesLoading,
	featuredTag,
	isDetailReady,
	onSubmit,
	selectableCategories,
	selectableTags,
	tagsLoading,
	uploadImage,
	uploadZip,
}: TemplateEditorFormProps) {
	const { t } = useTranslation()
	const form = useFormContext<SlidesTemplateFormValues>()
	const values = form.watch()

	return (
		<form
			className={isDetailReady ? "space-y-8 p-6" : "pointer-events-none invisible space-y-8 p-6"}
			id="slides-template-form"
			noValidate
			onSubmit={onSubmit}
		>
			<FormSection title={t("slidesTemplate.form.basic")}>
				<div className="grid gap-4 sm:grid-cols-2">
					<FormField
						control={form.control}
						name="label_zh"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("slidesTemplate.form.nameZh")}
									<RequiredMark />
								</FormLabel>
								<FormControl>
									<Input maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.name} {...field}  data-testid="platform-slides-template-input" />
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="label_en"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("slidesTemplate.form.nameEn")}
									<RequiredMark />
								</FormLabel>
								<FormControl>
									<Input maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.name} {...field}  data-testid="platform-slides-template-input" />
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="description_zh"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("slidesTemplate.form.descriptionZh")}
									<RequiredMark />
								</FormLabel>
								<FormControl>
									<Textarea
										maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.description}
										rows={3}
										{...field}
									 data-testid="platform-slides-template-textarea-input"/>
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="description_en"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("slidesTemplate.form.descriptionEn")}
									<RequiredMark />
								</FormLabel>
								<FormControl>
									<Textarea
										maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.description}
										rows={3}
										{...field}
									 data-testid="platform-slides-template-textarea-input"/>
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
				</div>
				<div className="space-y-4">
					<FormField
						control={form.control}
						name="category_code"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("slidesTemplate.form.category")}</FormLabel>
								<SearchableCategorySelect
									clearButtonTestId="platform-slides-template-editor-category-clear-button"
									clearSearchButtonTestId="platform-slides-template-editor-category-search-clear-button"
									contentTestId="platform-slides-template-editor-category-content"
									emptyTestId="platform-slides-template-editor-category-empty"
									inputTestId="platform-slides-template-editor-category-search-input"
									loadingTestId="platform-slides-template-editor-category-loading"
									optionTestId="platform-slides-template-editor-category-option"
									triggerTestId="platform-slides-template-editor-category-trigger"
									isLoading={categoriesLoading}
									onChange={field.onChange}
									options={selectableCategories}
									value={field.value}
								/>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="tag_codes"
						render={({ field }) => (
							<div className="space-y-4">
								<div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3">
									<div className="min-w-0">
										<div className="text-sm font-medium">
											{t("slidesTemplate.form.featured")}
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{featuredTag
												? t("slidesTemplate.form.featuredDescription")
												: t("slidesTemplate.form.featuredHint")}
										</p>
									</div>
									<Switch
										checked={field.value.includes(FEATURED_SLIDES_TEMPLATE_TAG_CODE)}
										disabled={
											!featuredTag ||
											featuredTag.status !== slidesTemplateStatus.enabled
										}
										onCheckedChange={(checked) =>
											field.onChange(
												setTagEnabled(
													field.value,
													FEATURED_SLIDES_TEMPLATE_TAG_CODE,
													checked,
												),
											)
										}
									 data-testid="platform-slides-template-switch"/>
								</div>
								<FormItem>
									<FormLabel>{t("slidesTemplate.form.tags")}</FormLabel>
									<SearchableTagSelect
										isLoading={tagsLoading}
										onChange={field.onChange}
										options={selectableTags}
										value={field.value}
									 triggerTestId="platform-slides-template-tag-select-trigger" contentTestId="platform-slides-template-tag-select-content" searchInputTestId="platform-slides-template-tag-select-search-input" searchClearButtonTestId="platform-slides-template-tag-select-search-clear-button" optionTestId="platform-slides-template-tag-select-option" loadingTestId="platform-slides-template-tag-select-loading" emptyTestId="platform-slides-template-tag-select-empty" clearButtonTestId="platform-slides-template-tag-select-clear-button"/>
									<FormMessage className="text-xs" />
								</FormItem>
							</div>
						)}
					/>
				</div>
			</FormSection>

			<FormSection title={t("slidesTemplate.form.resources")}>
				<div className="grid gap-4 sm:grid-cols-2">
					<FormField
						control={form.control}
						name="thumbnail_file_key"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("slidesTemplate.form.cover")}
									<RequiredMark />
								</FormLabel>
								<FormControl>
									<TemplateEditorUploadField
										accept="image/*"
										fileName={field.value}
										icon={<ImagePlus className="size-5" />}
										kind="image"
										onBlur={field.onBlur}
										onFiles={(files) => uploadImage("thumbnail", files)}
										pasteable
										previewUrl={values.thumbnail_url}
										ref={field.ref}
									/>
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="collage_file_key"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("slidesTemplate.form.collage")}</FormLabel>
								<FormControl>
									<TemplateEditorUploadField
										accept="image/*"
										fileName={field.value}
										icon={<ImagePlus className="size-5" />}
										kind="image"
										onBlur={field.onBlur}
										onFiles={(files) => uploadImage("collage", files)}
										pasteable
										previewUrl={values.collage_url}
										ref={field.ref}
									/>
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
				</div>
				<FormField
					control={form.control}
					name="template_file_key"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("slidesTemplate.form.zip")}
								<RequiredMark />
							</FormLabel>
							<FormControl>
								<TemplateEditorUploadField
									accept=".zip,application/zip,application/x-zip-compressed"
									fileName={field.value}
									icon={<FileArchive className="size-5" />}
									kind="zip"
									onBlur={field.onBlur}
									onFiles={uploadZip}
									ref={field.ref}
								/>
							</FormControl>
							<FormMessage className="text-xs" />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="preview_url"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("slidesTemplate.form.previewUrl")}</FormLabel>
							<FormControl>
								<Input
									maxLength={SLIDES_TEMPLATE_FIELD_LIMITS.previewUrl}
									placeholder="https://"
									{...field}
								 data-testid="platform-slides-template-input"/>
							</FormControl>
							<FormMessage className="text-xs" />
						</FormItem>
					)}
				/>
			</FormSection>

			<FormSection title={t("slidesTemplate.form.settings")}>
				<div className="grid gap-4 sm:grid-cols-2">
					<FormField
						control={form.control}
						name="code"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("slidesTemplate.form.templateCode")}
									<RequiredMark />
								</FormLabel>
								<FormControl>
									<Input readOnly {...field}  data-testid="platform-slides-template-input" />
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="sort"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("slidesTemplate.form.sort")}</FormLabel>
								<FormControl>
									<SortInput
										min={0}
										onBlur={field.onBlur}
										onValueChange={field.onChange}
										ref={field.ref}
										value={field.value}
									/>
								</FormControl>
								<FormMessage className="text-xs" />
							</FormItem>
						)}
					/>
				</div>
				<FormField
					control={form.control}
					name="status"
					render={({ field }) => (
						<FormItem className="flex items-center justify-between rounded-lg border p-4">
							<FormLabel>{t("slidesTemplate.form.status")}</FormLabel>
							<FormControl>
								<Switch checked={field.value} onCheckedChange={field.onChange}  data-testid="platform-slides-template-switch" />
							</FormControl>
						</FormItem>
					)}
				/>
			</FormSection>
		</form>
	)
}

function FormSection({ children, title }: { children: ReactNode; title: ReactNode }) {
	return (
		<section className="space-y-4">
			<h3 className="border-b pb-2 text-sm font-semibold">{title}</h3>
			{children}
		</section>
	)
}

function RequiredMark() {
	return <span className="ml-1 text-destructive">*</span>
}

type SortInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "onChange" | "value"> & {
	onValueChange: (value: number) => void
	value: number
}

const SortInput = forwardRef<HTMLInputElement, SortInputProps>(function SortInput(
	{ onBlur, onFocus, onValueChange, value, ...props },
	ref,
) {
	const [draft, setDraft] = useState(String(value))
	const editingRef = useRef(false)

	useEffect(() => {
		if (!editingRef.current) setDraft(String(value))
	}, [value])

	return (
		<Input
			{...props}
			onBlur={(event) => {
				editingRef.current = false
				if (draft === "") {
					setDraft("0")
					onValueChange(0)
				}
				onBlur?.(event)
			}}
			onChange={(event) => {
				const nextValue = event.target.value
				setDraft(nextValue)
				onValueChange(nextValue === "" ? 0 : Number(nextValue))
			}}
			onFocus={(event) => {
				editingRef.current = true
				onFocus?.(event)
			}}
			ref={ref}
			type="number"
			value={draft}
		 data-testid="platform-slides-template-input"/>
	)
})
