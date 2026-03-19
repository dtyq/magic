import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/lib/utils"
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
	})

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium leading-none text-foreground">
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
			/>
			{showError && <p className="text-sm text-destructive">{error}</p>}
		</div>
	)
})
