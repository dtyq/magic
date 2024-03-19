import { useContext } from "react"
import { BaseColorContext } from "./context"

/**
 * 获取当前主题基础颜色变量
 * @returns
 */
export const useBaseColor = () => {
	return useContext(BaseColorContext)
}
