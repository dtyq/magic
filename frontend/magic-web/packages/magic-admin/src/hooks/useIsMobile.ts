import { useResponsive } from "ahooks"

export const useIsMobile = () => {
	const { md } = useResponsive()
	return !md
}
