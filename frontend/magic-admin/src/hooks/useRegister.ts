import { useMount } from "ahooks"
import { useRegisterSearchComponent } from "components"
import {
	PriceRange,
	PriceRangeSelectName,
} from "@/pages/PlatformPackage/OrderManagement/components/PriceRange"

const useRegister = () => {
	const registerComponent = useRegisterSearchComponent()

	useMount(() => {
		// 注册价格范围选择器
		registerComponent(PriceRangeSelectName, {
			component: PriceRange,
		})
	})
}

export default useRegister
