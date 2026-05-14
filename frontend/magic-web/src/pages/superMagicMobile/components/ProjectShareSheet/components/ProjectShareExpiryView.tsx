import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { EXPIRY_OPTIONS } from "@/pages/superMagic/components/Share/ShareFields"
import type { ProjectShareSheetController } from "../types"

interface ProjectShareExpiryViewProps {
	controller: ProjectShareSheetController
}

/**
 * 有效期页只回写表单态，提交仍由创建页统一保存。
 */
export default function ProjectShareExpiryView({ controller }: ProjectShareExpiryViewProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex flex-col gap-2" data-testid="project-share-sheet-expiry-view">
			{EXPIRY_OPTIONS.map((option) => {
				const selected = controller.formState.shareExpiry === option.value
				return (
					<button
						key={option.value ?? "permanent"}
						type="button"
						className={cn(
							"flex h-12 items-center justify-between rounded-xl bg-card px-3 text-sm text-foreground active:opacity-75",
							selected && "font-medium",
						)}
						onClick={() => {
							controller.setShareExpiry(option.value)
							controller.goBack()
						}}
						data-testid="project-share-sheet-expiry-option"
					>
						<span>{t(option.label)}</span>
						{selected ? <Check className="h-4 w-4 text-primary" /> : null}
					</button>
				)
			})}
		</div>
	)
}
