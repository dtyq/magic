import { z } from "zod"
import { SLIDES_TEMPLATE_FIELD_LIMITS } from "@magic-admin-v2/features/platform-slides-template/utils"

type Translate = (key: string) => string

export function createSlidesTemplateFormSchema(t: Translate) {
	const requiredText = () =>
		z.string().trim().min(1, t("slidesTemplate.form.required"))

	return z.object({
		category_code: z.string(),
		code: requiredText().max(
			SLIDES_TEMPLATE_FIELD_LIMITS.code,
			t("slidesTemplate.validation.codeMaxLength"),
		),
		collage_file_key: z.string(),
		collage_url: z.string(),
		description_en: requiredText().max(
			SLIDES_TEMPLATE_FIELD_LIMITS.description,
			t("slidesTemplate.validation.descriptionMaxLength"),
		),
		description_zh: requiredText().max(
			SLIDES_TEMPLATE_FIELD_LIMITS.description,
			t("slidesTemplate.validation.descriptionMaxLength"),
		),
		label_en: requiredText().max(
			SLIDES_TEMPLATE_FIELD_LIMITS.name,
			t("slidesTemplate.validation.nameMaxLength"),
		),
		label_zh: requiredText().max(
			SLIDES_TEMPLATE_FIELD_LIMITS.name,
			t("slidesTemplate.validation.nameMaxLength"),
		),
		preview_image_file_keys: z.array(z.string()),
		preview_image_urls: z.array(z.string()),
		preview_url: z
			.string()
			.trim()
			.max(
				SLIDES_TEMPLATE_FIELD_LIMITS.previewUrl,
				t("slidesTemplate.validation.previewUrlMaxLength"),
			)
			.refine((value) => {
				if (!value) return true
				try {
					new URL(value)
					return true
				} catch {
					return false
				}
			}, t("slidesTemplate.form.invalidUrl")),
		sort: z
			.number()
			.finite()
			.int(t("slidesTemplate.validation.sortInteger"))
			.min(0, t("slidesTemplate.validation.sortNonNegative")),
		status: z.boolean(),
		tag_codes: z.array(z.string()),
		template_file_key: requiredText(),
		thumbnail_file_key: requiredText(),
		thumbnail_url: z.string(),
	})
}
