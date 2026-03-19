import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Globe, PencilLine } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { IdentitySection } from "./IdentitySection"
import { IdentityDetailsSection } from "./IdentityDetailsSection"
import { IdentityLocalizeDialog } from "./IdentityLocalizeDialog"

type LocalizeTab = "name" | "role" | "description"

interface IdentityCardContentProps {
	onOpenPrompt: () => void
	disabled?: boolean
}

export function IdentityCardContent({ onOpenPrompt, disabled = false }: IdentityCardContentProps) {
	const { t } = useTranslation("crew/create")
	const [localizeOpen, setLocalizeOpen] = useState(false)
	const [localizeTab, setLocalizeTab] = useState<LocalizeTab>("name")

	useEffect(() => {
		if (disabled) setLocalizeOpen(false)
	}, [disabled])

	function openLocalizeDialog(tab: LocalizeTab) {
		if (disabled) return
		setLocalizeTab(tab)
		setLocalizeOpen(true)
	}

	return (
		<>
			<div
				className="relative flex w-full flex-1 flex-col gap-6 rounded-xl border border-zinc-300 bg-card px-4 py-6"
				data-testid="crew-identity-card-content"
			>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="absolute right-[9px] top-[9px] h-9 w-9 shadow-xs"
					onClick={() => openLocalizeDialog("name")}
					disabled={disabled}
					data-testid="crew-identity-localize-button"
				>
					<Globe className="h-4 w-4" />
				</Button>

				<IdentitySection disabled={disabled} onOpenLocalize={openLocalizeDialog} />

				<IdentityDetailsSection disabled={disabled} onOpenLocalize={openLocalizeDialog} />
			</div>

			<Button
				variant="outline"
				className="relative h-9 w-full shrink-0 overflow-hidden text-base font-medium shadow-xs"
				onClick={onOpenPrompt}
				disabled={disabled}
				data-testid="crew-member-prompt-button"
			>
				<span className="min-w-0 truncate">{t("card.prompt")}</span>
				<PencilLine className="h-4 w-4" />
			</Button>

			<IdentityLocalizeDialog
				open={localizeOpen}
				onOpenChange={setLocalizeOpen}
				disabled={disabled}
				initialTab={localizeTab}
			/>
		</>
	)
}
