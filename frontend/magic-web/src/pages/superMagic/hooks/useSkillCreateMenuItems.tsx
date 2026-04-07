import type { MenuProps } from "antd"
import { useCallback, useState } from "react"
import { MessageCircleMore, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { skillsService } from "@/services/skills/SkillsService"

interface UseSkillCreateMenuItemsParams {
	createViaChatTestId: string
	importSkillTestId: string
}

export function useSkillCreateMenuItems({
	createViaChatTestId,
	importSkillTestId,
}: UseSkillCreateMenuItemsParams) {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const [isCreatingSkill, setIsCreatingSkill] = useState(false)

	const handleCreateViaChat = useCallback(async () => {
		if (isCreatingSkill) return

		setIsCreatingSkill(true)
		try {
			const { code } = await skillsService.createEmptySkill()
			navigate({ name: RouteName.SkillEdit, params: { code } })
		} catch {
			magicToast.error(t("skillsLibrary.createMenu.createViaChatFailed"))
		} finally {
			setIsCreatingSkill(false)
		}
	}, [isCreatingSkill, navigate, t])

	return useCallback(
		({ openImportDialog }: { openImportDialog: () => void }): MenuProps["items"] => [
			{
				key: "create-via-chat",
				icon: <MessageCircleMore className="mt-0.5 size-4 shrink-0" />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("skillsLibrary.createMenu.createViaChat")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("skillsLibrary.createMenu.createViaChatDesc")}
						</span>
					</div>
				),
				onClick: handleCreateViaChat,
				disabled: isCreatingSkill,
				"data-testid": createViaChatTestId,
			},
			{
				key: "import-skill",
				icon: <Upload className="mt-0.5 size-4 shrink-0" />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("skillsLibrary.createMenu.importSkill")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("skillsLibrary.createMenu.importSkillDesc")}
						</span>
					</div>
				),
				onClick: openImportDialog,
				"data-testid": importSkillTestId,
			},
		],
		[createViaChatTestId, handleCreateViaChat, importSkillTestId, isCreatingSkill, t],
	)
}
