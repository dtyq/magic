import { useState, type ComponentType } from "react"
import { useAppearance } from "@/context/AppearanceProvider"
import { ChevronRight, Smartphone, Monitor } from "lucide-react"

interface DemoWrapperProps {
	title: string
	description?: string
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: ComponentType<any>
	isMobile?: boolean
	useVisible?: boolean
}

function DemoWrapper({
	title,
	description,
	component: Component,
	isMobile,
	useVisible = false,
}: DemoWrapperProps) {
	const [open, setOpen] = useState(false)
	const { theme } = useAppearance()

	return (
		<div
			onClick={() => setOpen(true)}
			className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:shadow-lg ${
				theme === "dark"
					? "border-gray-700 bg-gray-800/50 hover:border-blue-500/50 hover:bg-gray-800"
					: "border-gray-200 bg-white hover:border-blue-400 hover:shadow-blue-500/10"
			}`}
		>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div
						className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
							theme === "dark"
								? "bg-gray-700 text-blue-400"
								: "bg-blue-50 text-blue-600"
						}`}
					>
						{isMobile ? (
							<Smartphone className="size-5" />
						) : (
							<Monitor className="size-5" />
						)}
					</div>
					<div
						className={`flex items-center gap-1 text-xs font-medium transition-transform group-hover:translate-x-1 ${
							theme === "dark" ? "text-gray-400" : "text-gray-500"
						}`}
					>
						<span>View Demo</span>
						<ChevronRight className="size-3" />
					</div>
				</div>

				<div>
					<h3
						className={`text-base font-semibold transition-colors ${
							theme === "dark"
								? "text-gray-100 group-hover:text-blue-400"
								: "text-gray-900 group-hover:text-blue-600"
						}`}
					>
						{title}
					</h3>
					{description && (
						<p
							className={`mt-1 line-clamp-2 text-sm leading-relaxed ${
								theme === "dark" ? "text-gray-400" : "text-gray-500"
							}`}
						>
							{description}
						</p>
					)}
				</div>
			</div>

			<div className="mt-4 flex items-center gap-2">
				{isMobile ? (
					<span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
						Mobile
					</span>
				) : (
					<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
						Desktop
					</span>
				)}
				<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
					React
				</span>
			</div>

			{/* Modal components - 用 div 阻止点击冒泡，避免关闭时事件冒泡到卡片触发 setOpen(true) */}
			{useVisible ? (
				<div onClick={(e) => e.stopPropagation()}>
					<Component visible={open} onClose={() => setOpen(false)} />
				</div>
			) : (
				<div onClick={(e) => e.stopPropagation()}>
					<Component open={open} onClose={() => setOpen(false)} />
				</div>
			)}
		</div>
	)
}

export default DemoWrapper
