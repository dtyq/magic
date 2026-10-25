import { useAdminStore } from "@admin/stores/admin"
import { useMemoizedFn } from "ahooks"
import useNavigate from "@admin/hooks/useNavigate"
import { getServiceProviderListFallbackRoute } from "@admin/pages/PlatformPackage/utils/serviceProviderRoutes"

export function useDetail(route: string) {
	const { isOfficialOrg, setExtraBreadcrumb } = useAdminStore()

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
			navigate({ name: getServiceProviderListFallbackRoute(isOfficialOrg) })
		} finally {
			setExtraBreadcrumb(null)
		}
	})

	return {
		handleDataLoaded,
		reback,
	}
}
