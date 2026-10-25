import { SlidersHorizontal } from "lucide-react"
import {
	Controller,
	useWatch,
	type Control,
	type FieldErrors,
	type UseFormSetValue,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { ReactNode } from "react"

import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Checkbox } from "@magic-admin-v2/components/ui/checkbox"
import { reasoningEffortLevels } from "@magic-admin-v2/features/platform-model-list/types"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { getCommonRuntimeFieldVisibility } from "@magic-admin-v2/features/platform-model-list/utils/model-runtime-config"
import type { ProviderModelType } from "@magic-admin-v2/features/platform-model-list/types"
import { getErrorMessage } from "@magic-admin-v2/features/platform-model-list/utils/model-editor"
import type { ModelEditorValues } from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema"

/** 编辑模型运行参数，关闭温度复用固定温度零的存储方式。 */
export function ModelEditorRuntimeFields({
	control,
	disabled,
	errors,
	isOfficialOrganization,
	modelType,
	setValue,
}: {
	control: Control<ModelEditorValues>
	disabled: boolean
	errors: FieldErrors<ModelEditorValues>
	isOfficialOrganization: boolean
	modelType: ProviderModelType
	setValue: UseFormSetValue<ModelEditorValues>
}) {
	const { t } = useTranslation()
	const supportsThinking = useWatch({ control, name: "support_deep_think" })
	const selectedEffortLevels = useWatch({ control, name: "reasoning_effort_levels" })
	const selectedEffortDefault = useWatch({ control, name: "reasoning_effort_default" })
	const effortLabels = {
		none: t("modelList.editor.reasoning.none"),
		minimal: t("modelList.editor.reasoning.minimal"),
		low: t("modelList.editor.reasoning.low"),
		medium: t("modelList.editor.reasoning.medium"),
		high: t("modelList.editor.reasoning.high"),
		xhigh: t("modelList.editor.reasoning.xhigh"),
		max: t("modelList.editor.reasoning.max"),
	}
	const visibility = getCommonRuntimeFieldVisibility(modelType, isOfficialOrganization)

	// 订阅表单值，使已有固定温度零在重新打开编辑器时也显示为关闭。
	const [temperatureMode, temperature] = useWatch({
		control,
		name: ["temperature_mode", "temperature"],
	})
	const isTemperatureDisabled =
		temperatureMode === "fixed" && temperature.trim() !== "" && Number(temperature) === 0

	/** 将关闭选项映射为固定温度零，恢复可调模式时使用本编辑器的默认温度。 */
	function handleTemperatureModeChange(value: string) {
		if (value !== "disabled" && value !== "fixed" && value !== "recommended") return
		const options = { shouldDirty: true, shouldValidate: true }
		if (value === "disabled") {
			setValue("temperature", "0", options)
		} else if (isTemperatureDisabled) {
			setValue("temperature", "0.7", options)
		}
		setValue("temperature_mode", value === "disabled" ? "fixed" : value, options)
	}

	return (
		<div className="grid gap-5">
			<div className="border-b pb-4">
				<div className="flex items-center gap-2">
					<SlidersHorizontal
						className="size-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<h3 className="text-base font-semibold" id="model-runtime-fields-title">
						{t("modelList.editor.section.runtime")}
					</h3>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{t("modelList.editor.runtimeDescription")}
				</p>
			</div>
			<div className="grid gap-4">
				{visibility.vectorSize ? (
					<NumberField
						control={control}
						disabled={disabled}
						description={t("modelList.editor.fieldDesc.vectorSize")}
						error={getErrorMessage(errors.vector_size?.message)}
						label={t("modelList.editor.field.vectorSize")}
						name="vector_size"
						placeholder={t("modelList.editor.placeholder.vectorSize")}
					/>
				) : visibility.maxTokens ? (
					<NumberField
						control={control}
						disabled={disabled}
						description={t("modelList.editor.fieldDesc.maxTokens")}
						error={getErrorMessage(errors.max_tokens?.message)}
						label={t("modelList.editor.field.maxTokens")}
						name="max_tokens"
						placeholder={t("modelList.editor.placeholder.maxTokens")}
					/>
				) : null}
				{visibility.maxOutputTokens ? (
					<NumberField
						control={control}
						disabled={disabled}
						description={t("modelList.editor.fieldDesc.maxOutputTokens")}
						error={getErrorMessage(errors.max_output_tokens?.message)}
						label={t("modelList.editor.field.maxOutputTokens")}
						required
						name="max_output_tokens"
						placeholder={t("modelList.editor.placeholder.maxOutputTokens")}
					/>
				) : null}
				{visibility.chatApi ? (
					<DialogFormField
						description={t("modelList.editor.fieldDesc.chatApi")}
						descriptionMode="text"
						fieldId="chat-api"
						label={t("modelList.editor.field.chatApi")}
					>
						<Controller
							control={control}
							name="chat_api"
							render={({ field }) => (
								<Select
									disabled={disabled}
									onValueChange={field.onChange}
									value={field.value}
								>
									<SelectTrigger
										className="w-full"
										id="chat-api"
										data-testid="platform-model-list-chat-api-trigger"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent data-testid="platform-model-list-chat-api-content">
										<SelectItem
											value="chat_completions"
											data-testid="platform-model-list-option"
										>
											{t("modelList.editor.chatApi.chatCompletions")}
										</SelectItem>
										<SelectItem
											value="responses"
											data-testid="platform-model-list-option"
										>
											{t("modelList.editor.chatApi.responses")}
										</SelectItem>
									</SelectContent>
								</Select>
							)}
						/>
					</DialogFormField>
				) : null}
				{visibility.temperature ? (
					<>
						<DialogFormField
							description={t("modelList.editor.fieldDesc.temperatureMode")}
							descriptionMode="text"
							fieldId="temperature-mode"
							label={t("modelList.editor.field.temperatureMode")}
						>
							<Controller
								control={control}
								name="temperature_mode"
								render={({ field }) => (
									<Select
										disabled={disabled}
										onValueChange={handleTemperatureModeChange}
										value={isTemperatureDisabled ? "disabled" : field.value}
									>
										<SelectTrigger
											className="w-full"
											id="temperature-mode"
											data-testid="platform-model-list-temperature-mode-trigger"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent data-testid="platform-model-list-temperature-mode-content">
											<SelectItem
												value="recommended"
												data-testid="platform-model-list-option"
											>
												{t("modelList.editor.temperature.recommended")}
											</SelectItem>
											<SelectItem
												value="fixed"
												data-testid="platform-model-list-option"
											>
												{t("modelList.editor.temperature.fixed")}
											</SelectItem>
											<SelectItem value="disabled">
												{t("modelList.editor.temperature.disabled")}
											</SelectItem>
										</SelectContent>
									</Select>
								)}
							/>
						</DialogFormField>
						{/* 隐藏输入区域但保留字段注册，确保固定温度零继续参与表单提交。 */}
						<div hidden={isTemperatureDisabled}>
							<NumberField
								control={control}
								disabled={disabled}
								description={t("modelList.editor.fieldDesc.temperature")}
								error={getErrorMessage(errors.temperature?.message)}
								label={t("modelList.editor.field.temperature")}
								required
								name="temperature"
								placeholder={t("modelList.editor.placeholder.temperature")}
								step="0.1"
							/>
						</div>
					</>
				) : null}
			</div>

			{visibility.capabilities ? (
				<div className="grid gap-3">
					<ToggleField
						control={control}
						description={t("modelList.editor.fieldDesc.supportTool")}
						disabled={disabled}
						label={t("modelList.editor.field.supportTool")}
						name="support_function"
					/>
					<ToggleField
						control={control}
						description={t("modelList.editor.fieldDesc.supportVision")}
						disabled={disabled}
						label={t("modelList.editor.field.supportVision")}
						name="support_multi_modal"
					/>
					<ToggleField
						control={control}
						description={t("modelList.editor.fieldDesc.supportThink")}
						disabled={disabled}
						label={t("modelList.editor.field.supportThink")}
						name="support_deep_think"
					>
						{supportsThinking ? (
							<>
								<Controller
									control={control}
									name="reasoning_effort_levels"
									render={({ field }) => (
										<fieldset disabled={disabled} className="grid gap-3">
											<legend className="mb-2 text-xs font-medium text-muted-foreground">
												{t("modelList.editor.reasoning.label")}
											</legend>
											<div className="flex flex-wrap gap-4">
												{reasoningEffortLevels.map((level) => (
													<label
														key={level}
														className="flex items-center gap-2 text-sm"
													>
														<Checkbox
															disabled={disabled}
															checked={field.value.includes(level)}
															onCheckedChange={(checked) => {
																const selected =
																	checked === true
																		? [...field.value, level]
																		: field.value.filter(
																				(item) =>
																					item !== level,
																			)
																field.onChange(
																	reasoningEffortLevels.filter(
																		(item) =>
																			selected.includes(item),
																	),
																)
																// 取消默认档位时回到服务商默认，不能留下不可选的默认值。
																if (
																	selectedEffortDefault ===
																		level &&
																	checked !== true
																) {
																	setValue(
																		"reasoning_effort_default",
																		null,
																		{
																			shouldDirty: true,
																			shouldValidate: true,
																		},
																	)
																}
															}}
														/>
														{effortLabels[level]}
													</label>
												))}
											</div>
										</fieldset>
									)}
								/>
								<div className="mt-4 grid gap-2 sm:grid-cols-[1fr_12rem] sm:items-center">
									<label
										htmlFor="reasoning-effort-default"
										className="text-sm font-medium"
									>
										{t("modelList.editor.reasoning.defaultLabel")}
									</label>
									<Controller
										control={control}
										name="reasoning_effort_default"
										render={({ field }) => (
											<Select
												disabled={disabled}
												value={field.value ?? "provider_default"}
												onValueChange={(value) => {
													if (value === "provider_default")
														field.onChange(null)
													else if (
														reasoningEffortLevels.some(
															(level) => level === value,
														)
													)
														field.onChange(value)
												}}
											>
												<SelectTrigger
													id="reasoning-effort-default"
													className="w-full"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="provider_default">
														{t(
															"modelList.editor.reasoning.providerDefault",
														)}
													</SelectItem>
													{reasoningEffortLevels
														.filter((level) =>
															selectedEffortLevels.includes(level),
														)
														.map((level) => (
															<SelectItem key={level} value={level}>
																{effortLabels[level]}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
								<FieldError
									className="mt-2 text-sm"
									message={
										errors.reasoning_effort_default
											? t("modelList.editor.reasoning.invalidDefault")
											: undefined
									}
								/>
							</>
						) : null}
					</ToggleField>
				</div>
			) : null}
		</div>
	)
}

function NumberField({
	control,
	disabled,
	description,
	error,
	label,
	name,
	required,
	placeholder,
	step = "1",
}: {
	control: Control<ModelEditorValues>
	disabled: boolean
	description?: string
	error?: string
	label: string
	name: "max_tokens" | "max_output_tokens" | "vector_size" | "temperature"
	required?: boolean
	placeholder: string
	step?: string
}) {
	return (
		<DialogFormField
			description={description}
			descriptionMode="text"
			fieldId={name}
			label={label}
			required={required}
		>
			<Controller
				control={control}
				name={name}
				render={({ field }) => (
					<Input
						disabled={disabled}
						id={name}
						min="0"
						onChange={field.onChange}
						placeholder={placeholder}
						step={step}
						type="number"
						value={field.value}
						data-testid="platform-model-list-input"
					/>
				)}
			/>
			<FieldError className="text-sm" message={error} />
		</DialogFormField>
	)
}

/** 能力开关与依赖配置共用一个边框，子项展开后仍属于同一能力。 */
function ToggleField({
	control,
	description,
	disabled,
	label,
	name,
	children,
}: {
	control: Control<ModelEditorValues>
	description: string
	disabled: boolean
	label: string
	name: "support_function" | "support_multi_modal" | "support_deep_think"
	children?: ReactNode
}) {
	return (
		<div className="rounded-md border">
			<div className="flex items-center justify-between gap-3 px-3 py-2.5">
				<div>
					<div className="text-sm font-medium">{label}</div>
					<p className="mt-1 text-xs text-muted-foreground">{description}</p>
				</div>
				<Controller
					control={control}
					name={name}
					render={({ field }) => (
						<Switch
							checked={field.value}
							disabled={disabled}
							onCheckedChange={field.onChange}
							data-testid="platform-model-list-switch"
						/>
					)}
				/>
			</div>
			{children && <div className="border-t px-3 py-3">{children}</div>}
		</div>
	)
}
