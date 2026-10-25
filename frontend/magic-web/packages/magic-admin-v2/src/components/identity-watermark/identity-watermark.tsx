import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DescriptionList, EditableDescriptionList } from "@magic-admin-v2/components/description-list";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import { Button } from "@magic-admin-v2/components/ui/button";
import { Checkbox } from "@magic-admin-v2/components/ui/checkbox";
import { Switch } from "@magic-admin-v2/components/ui/switch";
import {
	buildIdentityWatermarkPreviewText,
	identityWatermarkDepthTextColors,
	identityWatermarkDepths,
	identityWatermarkFields,
	type IdentityWatermarkDepth,
	type IdentityWatermarkField,
	type IdentityWatermarkValue,
} from "@magic-admin-v2/components/identity-watermark/watermark-utils";
import { cn } from "@magic-admin-v2/utils/cn";

/** 预览层需要铺满整块画布，重复次数按画布尺寸与旋转角度取值。 */
const watermarkPreviewRepeatCount = 12;

/** 预览画布旋转角度，与前台水印渲染保持一致。 */
const watermarkPreviewRotate = "-12deg";

/**
 * 文案注入。共享组件不读取任何业务域的 i18n key，由调用方（平台信息页 / 企业信息页）
 * 用自己的命名空间构造，字段与档位的 key 必须是静态字面量，因此在这里显式列出。
 */
export type IdentityWatermarkCopy = {
	/** 已选内容为空时的就地提示（开启水印后必须至少保留一项）。 */
	contentRequired: string;
	/**
	 * 面板底部的说明条；不传或传空串时不渲染。
	 * 企业水印页不需要平台配置口径的说明，因此可以选择不传。
	 */
	defaultTip?: string;
	depthLabels: Record<IdentityWatermarkDepth, string>;
	enabledLabel: string;
	disabledLabel: string;
	fieldContent: string;
	fieldContentDescription: string;
	fieldDepth: string;
	fieldDepthDescription: string;
	fieldEnabled: string;
	fieldEnabledDescription: string;
	fieldLabels: Record<IdentityWatermarkField, string>;
	fieldSamples: Record<IdentityWatermarkField, string>;
	previewFallback: string;
	previewTip: string;
	previewTitle: string;
};

/** 按固定顺序取出已选水印字段，保证预览与徽标顺序稳定。 */
function getSelectedWatermarkFields(value: IdentityWatermarkValue) {
	return identityWatermarkFields.filter((field) => value.fields.includes(field));
}

/** 未选择任何内容时回退到示例文案，避免预览出现空白画布。 */
function resolveWatermarkPreviewText(
	value: IdentityWatermarkValue,
	copy: IdentityWatermarkCopy,
) {
	return (
		buildIdentityWatermarkPreviewText(
			getSelectedWatermarkFields(value),
			copy.fieldSamples,
		) || copy.previewFallback
	);
}

function WatermarkFieldControl({ children, error }: { children: ReactNode; error?: string }) {
	return (
		<div className="grid gap-1.5">
			{children}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}

/**
 * 水印预览面板。只读态与编辑态共用同一个画布实现，编辑时随表单实时更新，
 * 避免两处预览在口径或视觉上出现差异。
 */
export function IdentityWatermarkPreviewPanel({
	copy,
	depth,
	enabled,
	previewText,
}: {
	copy: IdentityWatermarkCopy;
	depth: IdentityWatermarkDepth;
	enabled: boolean;
	previewText: string;
}) {
	return (
		<div className="space-y-2">
			<p className="text-sm font-medium">{copy.previewTitle}</p>
			<IdentityWatermarkCanvas depth={depth} enabled={enabled} previewText={previewText} />
			<p className="text-xs text-muted-foreground">{copy.previewTip}</p>
		</div>
	);
}

/** 只读态水印配置。 */
export function IdentityWatermarkPreview({
	copy,
	value,
}: {
	copy: IdentityWatermarkCopy;
	value: IdentityWatermarkValue;
}) {
	const selectedFields = getSelectedWatermarkFields(value);
	const previewText = resolveWatermarkPreviewText(value, copy);

	return (
		<div className="space-y-6">
			<DescriptionList
				items={[
					[
						copy.fieldEnabled,
						<Badge variant={value.enabled ? "success" : "outline"}>
							{value.enabled ? copy.enabledLabel : copy.disabledLabel}
						</Badge>,
					],
					[
						copy.fieldContent,
						selectedFields.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{selectedFields.map((field) => (
									<Badge className="whitespace-nowrap" key={field} variant="outline">
										{copy.fieldLabels[field]}
									</Badge>
								))}
							</div>
						) : (
							""
						),
					],
					[copy.fieldDepth, copy.depthLabels[value.depth]],
				]}
			/>
			<IdentityWatermarkPreviewPanel
				copy={copy}
				depth={value.depth}
				enabled={value.enabled}
				previewText={previewText}
			/>
		</div>
	);
}

/** 编辑态水印配置：开关 + 内容复选 + 深浅档位 + 实时预览。 */
export function IdentityWatermarkForm({
	copy,
	error,
	onChange,
	value,
}: {
	copy: IdentityWatermarkCopy;
	error?: string;
	onChange: (value: IdentityWatermarkValue) => void;
	value: IdentityWatermarkValue;
}) {
	const [contentError, setContentError] = useState("");
	// 水印关闭时内容和深浅保留在表单里但不可编辑，避免用户误以为配置已废弃。
	const isContentDisabled = !value.enabled;

	function toggleField(field: IdentityWatermarkField, checked: boolean) {
		const nextFields = checked
			? identityWatermarkFields.filter(
					(item) => item === field || value.fields.includes(item),
				)
			: value.fields.filter((item) => item !== field);

		// 与旧版一致：开启水印后至少保留一项内容，否则前台会渲染出空白水印。
		// 这里直接阻止改动并就地提示，避免用户切到别的分区后保存出无效配置。
		if (value.enabled && nextFields.length === 0) {
			setContentError(copy.contentRequired);
			return;
		}

		setContentError("");
		onChange({ ...value, fields: nextFields });
	}

	function toggleEnabled(checked: boolean) {
		setContentError("");
		onChange({ ...value, enabled: checked });
	}

	return (
		<div className="space-y-6">
			<EditableDescriptionList
				items={[
					[
						copy.fieldEnabled,
						<div className="flex h-9 items-center gap-3">
							<Switch checked={value.enabled} onCheckedChange={toggleEnabled} />
							<span className="text-sm text-muted-foreground">
								{value.enabled ? copy.enabledLabel : copy.disabledLabel}
							</span>
						</div>,
						copy.fieldEnabledDescription,
					],
					[
						copy.fieldContent,
						<WatermarkFieldControl error={contentError || error}>
							<div
								aria-label={copy.fieldContent}
								className={cn(
									"grid gap-x-5 gap-y-3 sm:grid-cols-2",
									isContentDisabled && "opacity-60",
								)}
								role="group"
							>
								{identityWatermarkFields.map((field) => (
									<div className="flex items-center gap-2" key={field}>
										<Checkbox
											checked={value.fields.includes(field)}
											disabled={isContentDisabled}
											id={`identity-watermark-field-${field}`}
											onCheckedChange={(checked) =>
												toggleField(field, checked === true)
											}
										/>
										<label
											className="text-sm"
											htmlFor={`identity-watermark-field-${field}`}
										>
											{copy.fieldLabels[field]}
										</label>
									</div>
								))}
							</div>
						</WatermarkFieldControl>,
						copy.fieldContentDescription,
					],
					[
						copy.fieldDepth,
						<div
							aria-label={copy.fieldDepth}
							className="grid grid-cols-3 gap-2"
							role="radiogroup"
						>
							{identityWatermarkDepths.map((depth) => (
								<Button
									aria-checked={value.depth === depth}
									className="w-full"
									disabled={isContentDisabled}
									key={depth}
									onClick={() => onChange({ ...value, depth })}
									role="radio"
									type="button"
									variant={value.depth === depth ? "default" : "outline"}
								>
									{copy.depthLabels[depth]}
								</Button>
							))}
						</div>,
						copy.fieldDepthDescription,
					],
				]}
			/>
			{copy.defaultTip ? (
				<p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
					<Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>{copy.defaultTip}</span>
				</p>
			) : null}
			{/* 编辑态同样展示预览，随开关、内容与深浅实时变化，方便保存前确认效果。 */}
			<IdentityWatermarkPreviewPanel
				copy={copy}
				depth={value.depth}
				enabled={value.enabled}
				previewText={resolveWatermarkPreviewText(value, copy)}
			/>
		</div>
	);
}

function IdentityWatermarkCanvas({
	depth,
	enabled,
	previewText,
}: {
	depth: IdentityWatermarkDepth;
	enabled: boolean;
	previewText: string;
}) {
	return (
		<div className="relative h-56 overflow-hidden rounded-md border bg-background">
			{/* 水印层需要超出画布再旋转，否则四角会露出空白；文字颜色由深浅档位决定，
			 * 属于渲染参数，因此使用内联样式而不是主题色。
			 * 列宽使用 max-content 而不是 1fr：选择较多内容时文案会变长，
			 * 零最小宽度的列会让相邻两列文字互相重叠。 */}
			<div
				aria-hidden="true"
				className="absolute -inset-24 grid grid-cols-[repeat(2,minmax(max-content,1fr))] content-around justify-items-start gap-x-6 gap-y-8"
				style={{
					color: identityWatermarkDepthTextColors[depth],
					opacity: enabled ? 1 : 0.35,
					transform: `rotate(${watermarkPreviewRotate})`,
				}}
			>
				{Array.from({ length: watermarkPreviewRepeatCount }, (_, index) => (
					<span className="whitespace-nowrap text-lg leading-6" key={index}>
						{previewText}
					</span>
				))}
			</div>
		</div>
	);
}
