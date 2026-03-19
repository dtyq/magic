import { useMemoizedFn } from "ahooks"
import { useSuperMagicNavigate } from "@/pages/superMagic/hooks/useSuperMagicNavigate"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { openLongTremMemoryModal } from "@/pages/superMagic/components/LongTremMemory"
import SuperMagicService from "@/pages/superMagic/services"
import { MenuKey } from "./useMenuItems"

function useGlobalMenuNavigate(onAfterNavigate?: () => void) {
	const navigate = useNavigate()
	const { handleSuperMagicNavigate } = useSuperMagicNavigate()

	const handleMenuItemClick = useMemoizedFn((key: MenuKey) => {
		switch (key) {
			case MenuKey.SuperMagic:
				handleSuperMagicNavigate()
				break
			case MenuKey.Flow:
				navigate({ name: RouteName.AgentList })
				break
			case MenuKey.Chat:
				navigate({ name: RouteName.Chat })
				break
			case MenuKey.Approval:
				navigate({ name: RouteName.MagicApprovalInitiate })
				break
			case MenuKey.Schedule:
				navigate({ name: RouteName.Calendar })
				break
			case MenuKey.Tasks:
				navigate({ name: RouteName.Tasks })
				break
			case MenuKey.Favorites:
				navigate({ name: RouteName.Favorites })
				break
			case MenuKey.KnowledgeBase:
				navigate({ name: RouteName.Knowledge })
				break
			case MenuKey.CloudDrive:
				navigate({ name: RouteName.DriveRecent })
				break
			case MenuKey.Applications:
				navigate({ name: RouteName.Applications })
				break
			case MenuKey.Contacts:
				navigate({ name: RouteName.Contacts })
				break
			case MenuKey.Preferences:
				navigate({ name: RouteName.Settings })
				break
			case MenuKey.LongTermMemory:
				openLongTremMemoryModal({
					onWorkspaceStateChange: SuperMagicService.route.navigateToState,
				})
				break
			default:
				break
		}

		onAfterNavigate?.()
	})

	return {
		handleMenuItemClick,
	}
}

export default useGlobalMenuNavigate
