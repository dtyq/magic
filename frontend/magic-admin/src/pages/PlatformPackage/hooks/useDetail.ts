import { useAdminStore } from "@/stores/admin"
import { useMemoizedFn } from "ahooks"
import useNavigate from "@/hooks/useNavigate"
import { RouteName } from "@/const/routes"

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
