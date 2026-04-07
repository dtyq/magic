import { type ReactNode, useCallback } from "react"
import { Upload, SquareLibrary } from "lucide-react"
import { useTranslation } from "react-i18next"
import SkillActionDropdown from "@/pages/superMagic/components/SkillActionDropdown"
import type { ImportSkillResponse, SkillSourceType } from "@/apis/modules/skills"

interface SkillAddDropdownProps {
	onImportSkill?: () => void
	onAddFromLibrary?: () => void
	/** Called after a skill is successfully imported via the dialog */
	onImportSuccess?: (result: ImportSkillResponse) => void | Promise<void>
	/** Show publish navigation prompt (reuses ImportSkillPublishPromptDialog) */
	promptPublishAfterImport?: boolean
	importSourceType?: SkillSourceType
	children: ReactNode
	placement?: string
	className?: string
}

function SkillAddDropdown({
	onImportSkill,
	onAddFromLibrary,
	onImportSuccess,
	promptPublishAfterImport = false,
	importSourceType,
	children,
	placement = "bottomRight",
	className,
}: SkillAddDropdownProps) {
	const { t } = useTranslation("crew/create")
	const createMenuItems = useCallback(
		({ openImportDialog }: { openImportDialog: () => void }) => [
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
				onClick: () => {
					openImportDialog()
					onImportSkill?.()
				},
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
		[t, onAddFromLibrary, onImportSkill],
	)

	return (
		<SkillActionDropdown
			createMenuItems={createMenuItems}
			onImportSuccess={onImportSuccess}
			promptPublishAfterImport={promptPublishAfterImport}
			importSourceType={importSourceType}
			placement={placement}
			className={className}
		>
			{children}
		</SkillActionDropdown>
	)
}

export default SkillAddDropdown
