import React, { useMemo, useState } from "react"
import { ConfigProvider, Layout, Menu, Segmented } from "antd"
import zhCN from "antd/locale/zh_CN"
import { COMPONENTS } from "./config"
import ThemeProvider from "../components/ThemeProvider"

const App: React.FC = () => {
	const [selectedKey, setSelectedKey] = useState(COMPONENTS[0].key)
	const current = COMPONENTS.find((c) => c.key === selectedKey)

	const [theme, setTheme] = useState<"light" | "dark" | "auto">("light")

	const prefersColorScheme = useMemo(() => {
		if (theme === "auto") {
			return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		}
		return theme
	}, [theme])

	return (
		<ConfigProvider locale={zhCN}>
			<ThemeProvider theme={theme}>
				<Layout style={{ height: "100vh", width: "100vw" }}>
					<Layout.Sider
						width={220}
						style={{
							borderRight: "1px solid #eee",
							height: "100%",
							overflow: "hidden",
							background: prefersColorScheme === "dark" ? "#141414" : "#fff",
						}}
					>
						<Layout.Content
							style={{
								height: "64px",
								fontWeight: 700,
								fontSize: 20,
								lineHeight: "64px",
								paddingLeft: 27,
								color: "#1890ff",
							}}
						>
							Magic UI Dev
						</Layout.Content>
						<Menu
							mode="inline"
							selectedKeys={[selectedKey]}
							style={{
								borderRight: 0,
								overflow: "auto",
								height: "calc(100% - 64px - 64px)",
							}}
							onClick={({ key }) => setSelectedKey(key as string)}
							items={COMPONENTS.map((c) => ({
								key: c.key,
								label: c.label,
							}))}
						/>
						<div
							style={{
								height: "64px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Segmented
								options={["light", "dark", "auto"]}
								value={theme}
								onChange={(value) => setTheme(value as "light" | "dark" | "auto")}
							/>
						</div>
					</Layout.Sider>
					<Layout>
						<Layout.Content style={{ padding: 32, height: "100%", overflow: "auto" }}>
							<div style={{ maxWidth: 900, margin: "0 auto" }}>
								{current?.element}
							</div>
						</Layout.Content>
					</Layout>
				</Layout>
			</ThemeProvider>
		</ConfigProvider>
	)
}

export default App
