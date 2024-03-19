import { CustomToken } from "@/common/types/theme"
import { colorScales, colorUsages } from "@/common/utils/palettes"
import { ConfigProvider } from "antd"
import React, { useMemo } from "react"
import { BaseColorContext } from "./context"

interface BaseColorProviderProps extends React.PropsWithChildren<{}> {}

const BaseColorProvider = ({ children }: BaseColorProviderProps) => {
	// 从 ConfigProvider 获取主题配置
	// @ts-ignore
	const { theme } = React.useContext(ConfigProvider.ConfigContext)
	const token = (theme?.token || {}) as CustomToken

	const value = useMemo(() => {
		return {
			colorScales: token.magicColorScales || colorScales,
			colorUsages: token.magicColorUsages || colorUsages,
		}
	}, [token.magicColorScales, token.magicColorUsages])

	return <BaseColorContext.Provider value={value}>{children}</BaseColorContext.Provider>
}

export default BaseColorProvider
