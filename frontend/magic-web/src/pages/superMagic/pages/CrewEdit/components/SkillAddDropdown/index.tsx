import { type ReactNode, useCallback, useMemo, useState } from "react"
import { Upload, SquareLibrary } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicDropdown from "@/components/base/MagicDropdown"
import { cn } from "@/lib/utils"
import ImportSkillDialog from "@/pages/superMagic/components/ImportSkillDialog"
import type { ImportSkillResponse } from "@/apis/modules/skills"

interface SkillAddDropdownProps {
	onImportSkill?: () => void
	onAddFromLibrary?: () => void
	/** Called after a skill is successfully imported via the dialog */
	onImportSuccess?: (result: ImportSkillResponse) => void | Promise<void>
	children: ReactNode
	placement?: string
	className?: string
}

function SkillAddDropdown({
	onImportSkill,
	onAddFromLibrary,
	onImportSuccess,
	children,
	placement = "bottomRight",
	className,
}: SkillAddDropdownProps) {
	const { t } = useTranslation("crew/create")
	const [importDialogOpen, setImportDialogOpen] = useState(false)

	const handleImportSkill = useCallback(() => {
		setImportDialogOpen(true)
		onImportSkill?.()
	}, [onImportSkill])

	const menuItems = useMemo(
		() => [
			{
				key: "import-skill",
				icon: <Upload className="mt-0.5 size-4 shrink-0" />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">{t("skills.importSkill")}</span>
						<span className="text-xs text-muted-foreground">
							{t("skills.importSkillDesc")}
						</span>
					</div>
				),
				onClick: handleImportSkill,
				"data-testid": "skill-add-menu-import",
			},
			{
				key: "add-from-library",
				icon: <SquareLibrary className="mt-0.5 size-4 shrink-0" />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">{t("skills.addFromLibrary")}</span>
						<span className="text-xs text-muted-foreground">
							{t("skills.addFromLibraryDesc")}
						</span>
					</div>
				),
				onClick: onAddFromLibrary,
				"data-testid": "skill-add-menu-library",
			},
		],
		[t, handleImportSkill, onAddFromLibrary],
	)

	return (
		<>
			<MagicDropdown
				menu={{ items: menuItems }}
				placement={placement}
				overlayClassName={cn(
					"min-w-[228px]",
					"[&_[data-slot='dropdown-menu-item']]:items-start",
					"[&_[data-slot='dropdown-menu-item']]:!p-2",
				)}
			>
				<span className={className}>{children}</span>
			</MagicDropdown>
			<ImportSkillDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				onSuccess={onImportSuccess}
			/>
		</>
	)
}

export default SkillAddDropdown
