import { useState } from "react"
import { AppearanceProvider, type LocaleType } from "@/index"
import Demo1 from "./Demo1"
import Demo2 from "./Demo2"
import Demo3 from "./Demo3"
import Demo4 from "./Demo4"
import Demo5 from "./Demo5"
import Demo6 from "./Demo6"
import Demo7 from "./Demo7"
import DemoWrapper from "./DemoWrapper"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Languages } from "lucide-react"

function App() {
	const [theme, setTheme] = useState<"light" | "dark">("light")
	const [language, setLanguage] = useState<LocaleType>("zh_CN")

	const toggleTheme = () => {
		setTheme((prev) => (prev === "light" ? "dark" : "light"))
	}

	const toggleLanguage = () => {
		setLanguage((prev) => (prev === "zh_CN" ? "en_US" : "zh_CN"))
	}

	const demos = [
		{
			id: 1,
			title: language === "zh_CN" ? "普通选择器【分段】" : "Normal Selector [Segmented]",
			description:
				language === "zh_CN"
					? "最常见的组织架构选择模式，支持多维分段切换。"
					: "Standard organization structure selection with multi-dimensional segments.",
			component: Demo1,
			useVisible: false,
		},
		{
			id: 2,
			title: language === "zh_CN" ? "暗黑选择器【右侧文案】" : "Dark Selector [Right Copy]",
			description:
				language === "zh_CN"
					? "演示用户/部门行右侧文案，包含已选择、不可选、可进入等状态。"
					: "Shows right-side row copy for selected, disabled, and navigable items.",
			component: Demo2,
			useVisible: false,
		},
		{
			id: 3,
			title: language === "zh_CN" ? "移动端选择器【分段】" : "Mobile Selector [Segmented]",
			description:
				language === "zh_CN"
					? "专为移动设备设计的全屏选择器，支持分段导航。"
					: "Full-screen selector designed for mobile devices with segmented navigation.",
			component: Demo3,
			isMobile: true,
			useVisible: true,
		},
		{
			id: 4,
			title:
				language === "zh_CN" ? "移动端选择器【无分段】" : "Mobile Selector [No Segmented]",
			description:
				language === "zh_CN"
					? "移动端极简模式，适合单一维度的用户选择。"
					: "Minimalist mobile mode perfect for single-dimension user selection.",
			component: Demo4,
			isMobile: true,
			useVisible: true,
		},
		{
			id: 5,
			title: language === "zh_CN" ? "普通选择器【分享场景】" : "Normal Selector [Share]",
			description:
				language === "zh_CN"
					? "针对分享任务定制，包含自定义卡片等分享专用UI。"
					: "Customized for sharing tasks, including specialized share UI components.",
			component: Demo5,
			useVisible: false,
		},
		{
			id: 6,
			title:
				language === "zh_CN" ? "移动端选择器【安全区域】" : "Mobile Selector [Safe Area]",
			description:
				language === "zh_CN"
					? "适配刘海屏及底部安全区域的移动端选择器。"
					: "Mobile selector adapted for notch screens and safe area insets.",
			component: Demo6,
			isMobile: true,
			useVisible: false,
		},
		{
			id: 7,
			title: language === "zh_CN" ? "移动端选择器【分享场景】" : "Mobile Selector [Share]",
			description:
				language === "zh_CN"
					? "移动端分享场景适配，支持复杂业务逻辑。"
					: "Mobile-optimized sharing scenarios supporting complex business logic.",
			component: Demo7,
			isMobile: true,
			useVisible: false,
		},
	]

	return (
		<AppearanceProvider theme={theme} language={language}>
			<div
				className={`min-h-screen transition-all duration-300 ${theme} ${
					theme === "dark" ? "bg-[#0f172a] text-gray-100" : "bg-[#f8fafc] text-gray-900"
				}`}
			>
				{/* Header with controls */}
				<header
					className={`sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300 ${
						theme === "dark"
							? "border-white/10 bg-slate-900/80"
							: "border-black/5 bg-white/80"
					}`}
				>
					<div className="container mx-auto flex items-center justify-between px-6 py-4">
						<div className="flex items-center gap-3">
							<div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
								<Languages className="size-5" />
							</div>
							<h1 className="text-lg font-bold tracking-tight">
								{language === "zh_CN" ? "用户选择器" : "User Selector"}
								<span className="ml-2 text-xs font-normal opacity-50">v1.6.9</span>
							</h1>
						</div>
						<div className="flex items-center gap-3">
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleTheme}
								className={`size-10 rounded-full transition-all ${
									theme === "dark"
										? "bg-white/5 text-yellow-400 hover:bg-white/10"
										: "bg-black/5 text-gray-600 hover:bg-black/10"
								}`}
								title={
									theme === "light" ? "切换到暗黑模式" : "Switch to light mode"
								}
							>
								{theme === "light" ? (
									<Moon className="size-5" />
								) : (
									<Sun className="size-5" />
								)}
							</Button>
							<Button
								variant="ghost"
								onClick={toggleLanguage}
								className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
									theme === "dark"
										? "bg-white/5 hover:bg-white/10"
										: "bg-black/5 hover:bg-black/10"
								}`}
							>
								<Languages className="size-4" />
								<span>{language === "zh_CN" ? "English" : "中文"}</span>
							</Button>
						</div>
					</div>
				</header>

				{/* Hero Section */}
				<section className="container mx-auto px-6 py-12 text-center">
					<h2
						className={`mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl ${
							theme === "dark" ? "text-white" : "text-slate-900"
						}`}
					>
						{language === "zh_CN" ? "强大且灵活的" : "Powerful & Flexible"}
						<span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
							{" "}
							{language === "zh_CN" ? "用户组件" : "User Component"}
						</span>
					</h2>
					<p
						className={`mx-auto max-w-2xl text-lg ${
							theme === "dark" ? "text-slate-400" : "text-slate-600"
						}`}
					>
						{language === "zh_CN"
							? "支持多种业务场景，适配移动端与桌面端，提供极致的用户交互体验。"
							: "Supporting multiple business scenarios, adapted for mobile and desktop, providing the ultimate user interaction experience."}
					</p>
				</section>

				{/* Main content */}
				<main className="container mx-auto px-6 pb-20">
					{/* Demo grid */}
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{demos.map((demo) => (
							<DemoWrapper
								key={demo.id}
								title={demo.title}
								description={demo.description}
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								component={demo.component as any}
								isMobile={demo.isMobile}
								useVisible={demo.useVisible}
							/>
						))}
					</div>
				</main>
			</div>
		</AppearanceProvider>
	)
}

export default App
