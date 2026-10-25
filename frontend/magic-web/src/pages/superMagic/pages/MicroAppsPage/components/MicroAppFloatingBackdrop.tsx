import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
	BarChart3,
	Database,
	FileText,
	MessageSquareText,
	Plug,
	Table2,
	Workflow,
} from "lucide-react"
import { useRef, type ReactNode, type RefObject } from "react"
import { cn } from "@/utils/cn"

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface MicroAppFloatingBackdropProps {
	scrollContainerRef: RefObject<HTMLElement | null>
	heroRef: RefObject<HTMLElement | null>
	active?: boolean
	mobile?: boolean
}

type TileTone = "blue" | "dark" | "light" | "mint" | "violet"

const TILE_TONES: Record<TileTone, string> = {
	blue: "border-[#2f73ff]/30 bg-[#2f73ff] text-white",
	dark: "border-white/10 bg-[#172037] text-white",
	light: "border-white/90 bg-white/95 text-[#172037]",
	mint: "border-[#83e8b2]/30 bg-[#dff8e9] text-[#172037]",
	violet: "border-[#7869e6]/25 bg-[#7869e6] text-white",
}

function TileChrome({ icon }: { icon: ReactNode }) {
	return (
		<div className="border-current/10 flex items-center justify-between border-b px-4 py-3">
			<div className="flex items-center gap-1.5">
				<span className="size-1.5 rounded-full bg-current opacity-25" />
				<span className="size-1.5 rounded-full bg-current opacity-15" />
				<span className="size-1.5 rounded-full bg-current opacity-10" />
			</div>
			<div className="bg-current/10 flex size-7 items-center justify-center rounded-lg">
				{icon}
			</div>
		</div>
	)
}

function BackdropTile({
	className,
	tone = "light",
	icon,
	children,
}: {
	className: string
	tone?: TileTone
	icon: ReactNode
	children: ReactNode
}) {
	return (
		<div
			className={cn(
				"micro-app-mosaic-tile absolute overflow-hidden rounded-[28px] border shadow-[0_24px_70px_rgba(23,32,55,0.12)]",
				TILE_TONES[tone],
				className,
			)}
			data-testid="micro-app-mosaic-tile"
		>
			<TileChrome icon={icon} />
			{children}
		</div>
	)
}

function AnalyticsPreview({ active }: { active: boolean }) {
	return (
		<div className="grid h-[calc(100%_-_52px)] grid-cols-[0.72fr_1.28fr] gap-4 p-5">
			<div className="space-y-3">
				<div className="bg-white/18 h-7 w-3/4 rounded-lg" />
				<div className="h-20 rounded-2xl border border-white/15 bg-white/10" />
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-white/12 h-14 rounded-xl" />
					<div className="bg-white/12 h-14 rounded-xl" />
				</div>
			</div>
			<div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 pb-4 pt-8">
				{[35, 62, 48, 78, 58, 90, 72].map((height, index) => (
					<span
						key={height}
						className="relative flex-1 overflow-hidden rounded-t-md bg-white/75"
						style={{ height: `${height}%` }}
					>
						<span
							className={cn(
								"micro-app-focus-indicator micro-app-analytics-focus-indicator absolute inset-0 rounded-t-md bg-[#ffd84d] shadow-[0_0_20px_rgba(255,216,77,0.78)] transition-transform duration-500 ease-out",
								active ? "translate-y-0" : "translate-y-full",
							)}
							style={{ transitionDelay: active ? `${index * 45}ms` : "0ms" }}
							data-active={active}
						/>
					</span>
				))}
			</div>
		</div>
	)
}

function TablePreview() {
	return (
		<div className="grid h-[calc(100%_-_52px)] grid-cols-[92px_1fr] gap-4 p-4">
			<div className="space-y-2 rounded-2xl bg-[#172037]/[0.045] p-3">
				{[72, 54, 68, 46, 62].map((width) => (
					<div
						key={width}
						className="bg-[#172037]/12 h-2 rounded-full"
						style={{ width }}
					/>
				))}
			</div>
			<div className="overflow-hidden rounded-2xl border border-[#172037]/10">
				{[0, 1, 2, 3].map((row) => (
					<div
						key={row}
						className="grid grid-cols-[1fr_0.7fr_0.55fr] gap-3 border-b border-[#172037]/[0.07] px-3 py-3 last:border-0"
					>
						<span className="h-2 rounded-full bg-[#172037]/15" />
						<span className="h-2 rounded-full bg-[#7869e6]/20" />
						<span className="h-2 rounded-full bg-[#53d38e]/30" />
					</div>
				))}
			</div>
		</div>
	)
}

function FlowPreview() {
	return (
		<div className="relative h-[calc(100%_-_52px)] p-5">
			<div className="bg-current/20 absolute left-[22%] top-[28%] h-px w-[54%]" />
			<div className="bg-current/20 absolute left-[28%] top-[28%] h-[45%] w-px" />
			<div className="bg-current/20 absolute right-[24%] top-[28%] h-[45%] w-px" />
			{[
				"left-[12%] top-[16%]",
				"left-[42%] top-[16%]",
				"right-[12%] top-[16%]",
				"left-[18%] bottom-[14%]",
				"right-[18%] bottom-[14%]",
			].map((position, index) => (
				<div
					key={position}
					className={cn(
						"border-current/15 absolute flex h-12 w-20 items-center justify-center rounded-2xl border bg-white/15",
						position,
					)}
				>
					<span
						className={cn(
							"size-3 rounded-full",
							index === 2 ? "bg-[#7be8ae]" : "bg-white/65",
						)}
					/>
				</div>
			))}
		</div>
	)
}

function ConnectorPreview({ active }: { active: boolean }) {
	return (
		<div className="grid h-[calc(100%_-_52px)] grid-cols-3 gap-3 p-5">
			{[0, 1, 2, 3, 4, 5].map((item) => (
				<div
					key={item}
					className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07]"
				>
					<span
						className={cn(
							"size-5 rounded-lg transition-[background-color,box-shadow] duration-300",
							item % 3 === 0
								? cn(
										"micro-app-focus-indicator",
										active
											? "bg-[#ffd84d] shadow-[0_0_22px_rgba(255,216,77,0.85)]"
											: "bg-[#7be8ae]",
									)
								: item % 3 === 1
									? "bg-[#8b7cff]"
									: "bg-[#64b5ff]",
						)}
						data-active={item % 3 === 0 ? active : undefined}
					/>
				</div>
			))}
		</div>
	)
}

function DocumentPreview() {
	return (
		<div className="h-[calc(100%_-_52px)] space-y-3 p-5">
			<div className="bg-[#172037]/14 h-5 w-2/5 rounded-full" />
			<div className="space-y-2 rounded-2xl bg-[#172037]/[0.045] p-4">
				{[96, 82, 90, 64].map((width) => (
					<div
						key={width}
						className="h-2 rounded-full bg-[#172037]/10"
						style={{ width: `${width}%` }}
					/>
				))}
			</div>
			<div className="grid grid-cols-3 gap-2">
				<div className="bg-[#7869e6]/12 h-12 rounded-xl" />
				<div className="bg-[#53d38e]/18 h-12 rounded-xl" />
				<div className="bg-[#64b5ff]/16 h-12 rounded-xl" />
			</div>
		</div>
	)
}

function DesktopMosaic({ active }: { active: boolean }) {
	return (
		<div className="absolute left-1/2 top-1/2 h-[900px] w-[1800px] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] scale-[0.72] 2xl:h-[1320px] 2xl:w-[2320px] 2xl:scale-[0.76]">
			<div className="micro-app-mosaic-layer-back absolute inset-0 will-change-transform">
				<BackdropTile
					className="left-[70px] top-[-36px] h-[245px] w-[390px]"
					icon={<FileText className="size-4" aria-hidden />}
				>
					<DocumentPreview />
				</BackdropTile>
				<BackdropTile
					className="left-[630px] top-[-82px] h-[260px] w-[440px]"
					icon={<Table2 className="size-4" aria-hidden />}
				>
					<TablePreview />
				</BackdropTile>
				<BackdropTile
					className="right-[40px] top-[42px] h-[280px] w-[430px]"
					tone="mint"
					icon={<Database className="size-4" aria-hidden />}
				>
					<TablePreview />
				</BackdropTile>
				<BackdropTile
					className="bottom-[-40px] left-[92px] h-[255px] w-[380px]"
					icon={<MessageSquareText className="size-4" aria-hidden />}
				>
					<DocumentPreview />
				</BackdropTile>
			</div>

			<div className="micro-app-mosaic-layer-front absolute inset-0 will-change-transform">
				<BackdropTile
					className="left-[-70px] top-[310px] h-[315px] w-[540px]"
					tone="blue"
					icon={<BarChart3 className="size-4" aria-hidden />}
				>
					<AnalyticsPreview active={active} />
				</BackdropTile>
				<BackdropTile
					className="right-[-100px] top-[385px] h-[300px] w-[500px]"
					tone="dark"
					icon={<Plug className="size-4" aria-hidden />}
				>
					<ConnectorPreview active={active} />
				</BackdropTile>
				<BackdropTile
					className="bottom-[-96px] left-[650px] h-[290px] w-[460px]"
					tone="violet"
					icon={<Workflow className="size-4" aria-hidden />}
				>
					<FlowPreview />
				</BackdropTile>
				<BackdropTile
					className="bottom-[-76px] right-[150px] h-[270px] w-[420px]"
					icon={<Database className="size-4" aria-hidden />}
				>
					<TablePreview />
				</BackdropTile>
			</div>
		</div>
	)
}

function MobileMosaic({ active }: { active: boolean }) {
	return (
		<div className="absolute left-1/2 top-1/2 h-[900px] w-[760px] -translate-x-1/2 -translate-y-1/2 -rotate-[12deg] scale-[0.72]">
			<div className="micro-app-mosaic-layer-back absolute inset-0 will-change-transform">
				<BackdropTile
					className="left-[40px] top-[10px] h-[210px] w-[310px]"
					icon={<FileText className="size-4" aria-hidden />}
				>
					<DocumentPreview />
				</BackdropTile>
				<BackdropTile
					className="right-[20px] top-[70px] h-[220px] w-[330px]"
					tone="mint"
					icon={<Database className="size-4" aria-hidden />}
				>
					<TablePreview />
				</BackdropTile>
			</div>
			<div className="micro-app-mosaic-layer-front absolute inset-0 will-change-transform">
				<BackdropTile
					className="left-[-20px] top-[360px] h-[250px] w-[390px]"
					tone="blue"
					icon={<BarChart3 className="size-4" aria-hidden />}
				>
					<AnalyticsPreview active={active} />
				</BackdropTile>
				<BackdropTile
					className="right-[-36px] top-[430px] h-[245px] w-[370px]"
					tone="dark"
					icon={<Plug className="size-4" aria-hidden />}
				>
					<ConnectorPreview active={active} />
				</BackdropTile>
				<BackdropTile
					className="bottom-[-34px] left-[280px] h-[230px] w-[350px]"
					tone="violet"
					icon={<Workflow className="size-4" aria-hidden />}
				>
					<FlowPreview />
				</BackdropTile>
			</div>
		</div>
	)
}

/**
 * 用倾斜的微应用预览拼贴表达「可生成多种网页应用」，中心遮罩为标题和输入保留稳定阅读区域。
 */
export default function MicroAppFloatingBackdrop({
	scrollContainerRef,
	heroRef,
	active = false,
	mobile = false,
}: MicroAppFloatingBackdropProps) {
	const scopeRef = useRef<HTMLDivElement>(null)

	useGSAP(
		() => {
			const scroller = scrollContainerRef.current
			const hero = heroRef.current
			if (!scroller || !hero) return

			const media = gsap.matchMedia()
			media.add("(prefers-reduced-motion: no-preference)", () => {
				const backLayer = scopeRef.current?.querySelector<HTMLElement>(
					".micro-app-mosaic-layer-back",
				)
				const frontLayer = scopeRef.current?.querySelector<HTMLElement>(
					".micro-app-mosaic-layer-front",
				)
				const wash = scopeRef.current?.querySelector<HTMLElement>(".micro-app-color-wash")
				if (!backLayer || !frontLayer || !wash) return

				gsap.timeline({
					scrollTrigger: {
						trigger: hero,
						scroller,
						start: "top top",
						end: "bottom top",
						scrub: 1,
					},
				})
					.to(backLayer, { x: mobile ? 16 : 38, y: mobile ? -42 : -72, ease: "none" }, 0)
					.to(
						frontLayer,
						{ x: mobile ? -20 : -46, y: mobile ? -68 : -112, ease: "none" },
						0,
					)
					.to(wash, { y: -48, scale: 1.08, ease: "none" }, 0)
			})

			return () => media.revert()
		},
		{ dependencies: [mobile], revertOnUpdate: true, scope: scopeRef },
	)

	return (
		<div
			ref={scopeRef}
			className="pointer-events-none absolute inset-0 overflow-hidden"
			aria-hidden
		>
			<div className="absolute inset-0 bg-[#edf0f2] dark:bg-[#101116]" />
			<div
				className={cn(
					"absolute inset-0 transition-opacity duration-500 dark:opacity-20",
					active ? "opacity-85" : "opacity-70",
				)}
				data-testid="micro-app-mosaic"
				data-active={active}
				data-mobile={mobile}
			>
				{mobile ? <MobileMosaic active={active} /> : <DesktopMosaic active={active} />}
			</div>
			<div className="micro-app-color-wash absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(248,248,245,0.99)_0%,rgba(248,248,245,0.97)_28%,rgba(248,248,245,0.82)_40%,rgba(248,248,245,0.2)_68%,transparent_84%)] will-change-transform dark:bg-[radial-gradient(ellipse_at_center,rgba(16,17,22,0.98)_0%,rgba(16,17,22,0.94)_35%,rgba(16,17,22,0.62)_56%,transparent_84%)]" />
			<div
				data-testid="micro-app-hero-light"
				className={cn(
					"absolute inset-0 bg-[radial-gradient(ellipse_at_32%_40%,rgba(255,255,255,0.85),transparent_55%),radial-gradient(ellipse_at_75%_70%,rgba(157,188,255,0.16),transparent_48%)] transition-opacity duration-1000 ease-out motion-reduce:transition-none dark:mix-blend-soft-light",
					active ? "opacity-50" : "opacity-25",
				)}
			/>
			<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(248,248,245,0.35),transparent_22%,transparent_78%,rgba(248,248,245,0.78))] dark:bg-[linear-gradient(to_bottom,rgba(16,17,22,0.45),transparent_25%,transparent_72%,rgba(16,17,22,0.8))]" />
		</div>
	)
}
