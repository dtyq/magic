import { useEffect } from "react"
import { useResponsive } from "ahooks"
import { interfaceStore } from "@/opensource/stores/interface"

export const useIsMobile = () => {
	const { md } = useResponsive()
	const isMobile = !md

	useEffect(() => {
		interfaceStore.setIsMobile(isMobile)
	}, [isMobile])

	return isMobile
}
