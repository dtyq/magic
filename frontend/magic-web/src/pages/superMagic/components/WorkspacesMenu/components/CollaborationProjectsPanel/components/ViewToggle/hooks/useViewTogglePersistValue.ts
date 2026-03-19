import { useUserInfo } from "@/models/user/hooks"
import { ViewMode } from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem"
import { platformKey } from "@/utils/storage"
import { useLocalStorageState } from "ahooks"

/**
 * 持久化视图模式
 * @returns 视图模式
 */
const useViewTogglePersistValue = ({
	localStorageKey = "view_toggle_value",
}: {
	localStorageKey?: string
} = {}) => {
	const { userInfo } = useUserInfo()

	const [viewMode, setViewMode] = useLocalStorageState(
		platformKey(
			`super_magic/${localStorageKey}/${userInfo?.organization_code}/${userInfo?.user_id}`,
		),
		{
			defaultValue: ViewMode.GRID,
		},
	)

	return {
		viewMode,
		setViewMode,
	}
}

export default useViewTogglePersistValue
