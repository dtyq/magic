import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import type { ShareNameFieldProps } from "./types"
import { useShareNameField } from "./hooks/useShareNameField"

export default memo(function ShareNameField(props: ShareNameFieldProps) {
	const {
		value,
		onChange,
		placeholder,
		defaultOpenFileId,
		selectedFiles = [],
		attachments = [],
		shareProject = false,
		projectName,
		projectMode,
	} = props

	const { t } = useTranslation("super")

	// 所有逻辑都在 hook 中
	const { defaultValue, showError, handleBlur, handleChange, error } = useShareNameField({
		value,
		onChange,
		defaultOpenFileId,
		selectedFiles,
		attachments,
		shareProject,
		projectName,
		projectMode,
	})

	return (
		<div className="flex flex-col gap-2" data-testid="share-name-field">
			<label
				className="text-sm font-medium leading-none text-foreground"
				data-testid="share-name-field-label"
			>
				{t("share.shareName")}
				<span className="ml-1 text-destructive">*</span>
			</label>
			<Input
				value={value}
				onChange={handleChange}
				onBlur={handleBlur}
				placeholder={placeholder || defaultValue || t("share.shareNamePlaceholder")}
				className={cn(
					"h-9",
					showError && "border-destructive focus-visible:ring-destructive",
				)}
				data-testid="handle-change"
			/>
			{showError && (
				<p className="text-sm text-destructive" data-testid="share-name-field-error">
					{error}
				</p>
			)}
		</div>
	)
})
