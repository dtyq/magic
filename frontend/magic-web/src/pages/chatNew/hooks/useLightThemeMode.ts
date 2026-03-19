import { configStore } from "@/models/config"
import { useMount } from "ahooks"

// 强制设置为亮色主题
const useLightThemeMode = () => {
	useMount(() => {
		if (configStore.theme.theme !== "light") {
			configStore.theme.setTheme("light")
		}
	})
}

export default useLightThemeMode
