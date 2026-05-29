import { useAdminStore } from "@admin/stores/admin"
import { useMemoizedFn } from "ahooks"
import useNavigate from "@admin/hooks/useNavigate"
import { RouteName } from "@admin/const/routes"

export function useDetail(route: string) {
	const { setExtraBreadcrumb } = useAdminStore()

	const navigate = useNavigate()

	const handleDataLoaded = useMemoizedFn((name: string | null) => {
		if (!name) {
			setExtraBreadcrumb(null)
			return
		}
		setExtraBreadcrumb([
			{
				key: route,
				title: name,
			},
		])
	})

	const reback = useMemoizedFn(() => {
		try {
			navigate({ delta: -1 })
		} catch (error) {
			navigate({ name: RouteName.AdminAIModel })
		} finally {
			setExtraBreadcrumb(null)
		}
	})

	return {
		handleDataLoaded,
		reback,
	}
}
