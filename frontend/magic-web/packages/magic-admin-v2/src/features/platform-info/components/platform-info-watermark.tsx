import { useTranslation } from "react-i18next"
import {
	IdentityWatermarkForm,
	IdentityWatermarkPreview,
	type IdentityWatermarkCopy,
} from "@magic-admin-v2/components/identity-watermark"
import type { PlatformInfoWatermark } from "@magic-admin-v2/features/platform-info/types"

/**
 * 平台水印的文案。共享组件不读取业务域 i18n key，因此这里把平台命名空间下的
 * 文案组装成 copy 注入；key 必须是静态字面量，所以逐项显式写出。
 */
function usePlatformWatermarkCopy(): IdentityWatermarkCopy {
	const { t } = useTranslation()

	return {
		contentRequired: t("platformInfo.validation.watermarkContentRequired"),
		defaultTip: t("platformInfo.watermark.defaultTip"),
		depthLabels: {
			light: t("platformInfo.watermark.depth.light"),
			standard: t("platformInfo.watermark.depth.standard"),
			strong: t("platformInfo.watermark.depth.strong"),
		},
		disabledLabel: t("common.disabled"),
		enabledLabel: t("common.enabled"),
		fieldContent: t("platformInfo.watermark.field.content"),
		fieldContentDescription: t("platformInfo.watermark.fieldDesc.content"),
		fieldDepth: t("platformInfo.watermark.field.depth"),
		fieldDepthDescription: t("platformInfo.watermark.fieldDesc.depth"),
		fieldEnabled: t("platformInfo.watermark.field.enabled"),
		fieldEnabledDescription: t("platformInfo.watermark.fieldDesc.enabled"),
		fieldLabels: {
			real_name: t("platformInfo.watermark.field.realName"),
			employee_no: t("platformInfo.watermark.field.employeeNo"),
			visit_time: t("platformInfo.watermark.field.visitTime"),
			department: t("platformInfo.watermark.field.department"),
			phone: t("platformInfo.watermark.field.phone"),
			email: t("platformInfo.watermark.field.email"),
		},
		fieldSamples: {
			real_name: t("platformInfo.watermark.preview.sample.realName"),
			employee_no: t("platformInfo.watermark.preview.sample.employeeNo"),
			visit_time: t("platformInfo.watermark.preview.sample.visitTime"),
			department: t("platformInfo.watermark.preview.sample.department"),
			phone: t("platformInfo.watermark.preview.sample.phone"),
			email: t("platformInfo.watermark.preview.sample.email"),
		},
		previewFallback: t("platformInfo.watermark.preview.fallback"),
		previewTip: t("platformInfo.watermark.preview.tip"),
		previewTitle: t("platformInfo.watermark.preview.title"),
	}
}

/** 平台信息 - 水印设置（只读态）。 */
export function PlatformInfoWatermarkPreview({ value }: { value: PlatformInfoWatermark }) {
	const copy = usePlatformWatermarkCopy()

	return <IdentityWatermarkPreview copy={copy} value={value} />
}

/** 平台信息 - 水印设置（编辑态）。 */
export function PlatformInfoWatermarkForm({
	error,
	onChange,
	value,
}: {
	error?: string
	onChange: (value: PlatformInfoWatermark) => void
	value: PlatformInfoWatermark
}) {
	const copy = usePlatformWatermarkCopy()

	return <IdentityWatermarkForm copy={copy} error={error} value={value} onChange={onChange} />
}
