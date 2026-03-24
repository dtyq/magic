import type { MenuProps } from "antd"
import { type ReactNode, useCallback, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import MagicDropdown from "@/components/base/MagicDropdown"
import ImportSkillDialog from "@/pages/superMagic/components/ImportSkillDialog"
import ImportSkillPublishPromptDialog from "@/pages/superMagic/components/ImportSkillPublishPromptDialog"
import type { ImportSkillResponse, SkillSourceType } from "@/apis/modules/skills"

interface SkillActionDropdownProps {
	children: ReactNode
	createMenuItems: (actions: { openImportDialog: () => void }) => MenuProps["items"]
	onImportSuccess?: (result: ImportSkillResponse) => void | Promise<void>
	promptPublishAfterImport?: boolean
	importSourceType?: SkillSourceType
	placement?: string
	className?: string
	overlayClassName?: string
}

function SkillActionDropdown({
	children,
	createMenuItems,
	onImportSuccess,
	promptPublishAfterImport = false,
	importSourceType,
	placement = "bottomRight",
	className,
	overlayClassName,
}: SkillActionDropdownProps) {
	const [importDialogOpen, setImportDialogOpen] = useState(false)
	const [publishPromptSkillCode, setPublishPromptSkillCode] = useState<string | null>(null)

	const openImportDialog = useCallback(() => {
		setImportDialogOpen(true)
	}, [])

	const handleImportSuccess = useCallback(
		async (result: ImportSkillResponse) => {
			await onImportSuccess?.(result)
			if (!promptPublishAfterImport) return
			setPublishPromptSkillCode(result.skill_code)
		},
		[onImportSuccess, promptPublishAfterImport],
	)

	const handlePublishPromptOpenChange = useCallback((open: boolean) => {
		if (open) return
		setPublishPromptSkillCode(null)
	}, [])

	const menuItems = useMemo(
		() => createMenuItems({ openImportDialog }),
		[createMenuItems, openImportDialog],
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
					overlayClassName,
				)}
			>
				<span className={className}>{children}</span>
			</MagicDropdown>
			<ImportSkillDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				onSuccess={handleImportSuccess}
				importSourceType={importSourceType}
			/>
			<ImportSkillPublishPromptDialog
				skillCode={publishPromptSkillCode}
				onOpenChange={handlePublishPromptOpenChange}
			/>
		</>
	)
}

export default SkillActionDropdown
