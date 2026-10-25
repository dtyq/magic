import { Outlet } from "react-router"
import useDrag from "@/hooks/electron/useDrag"
import { AnimatedGridPattern } from "@/layouts/SSOLayout/components/AnimatedGridPattern"
import Copyright from "@/components/other/Copyright"
import LanguageSelect from "@/layouts/SSOLayout/components/LanguageSelect"
import TopMeta from "@/layouts/SSOLayout/components/TopMeta"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { withLoginService } from "./providers/LoginServiceProvider"
import { service } from "@/services"
import { WindowMenu, MacMenu } from "@/layouts/BaseLayout/components/Header/components/DesktopMenu"
import { lazy, Suspense } from "react"

const EditionActivitySlogan = lazy(() => import("@/components/business/EditionActivity/Slogan"))

// Keep the existing login-form overrides local without generating another CSS-in-JS class.
const loginFormClassName = cn(
	"[&_.magic-btn:not(.magic-btn-link)]:text-sm [&_.magic-btn:not(.magic-btn-link)]:font-semibold [&_.magic-btn:not(.magic-btn-link)]:leading-5",
	"[&_.magic-btn:not(.magic-btn-link)]:[--magic-button-border-color-disabled:transparent]",
	"[&_.magic-btn:not(.magic-btn-link):disabled]:bg-neutral-100 dark:[&_.magic-btn:not(.magic-btn-link):disabled]:bg-neutral-800",
	"[&_.magic-form-item]:[--magic-form-label-color:rgb(var(--foreground-rgb)/0.6)]",
	"[&_.magic-form-item_.magic-form-item-additional]:mt-2.5 [&_.magic-form-item_.magic-form-item-explain-error]:text-left",
)

export function Layout() {
	const { onMouseDown } = useDrag()

	return (
		<AnimatedGridPattern
			// Parent width is intentional: resumed embedded WebViews can retain a stale viewport width.
			className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background bg-cover bg-center bg-no-repeat"
			onMouseDown={onMouseDown}
		>
			<div className="box-border flex h-full w-full items-center justify-between overflow-hidden text-center">
				<ScrollArea
					className="h-full min-h-0 flex-1"
					// The Radix content wrapper owns the column so short pages stretch and long forms scroll.
					viewportClassName="[&>div]:!flex [&>div]:min-h-full [&>div]:flex-col [&>div]:items-center [&>div]:pb-5 [@media(max-width:700px)]:[&>div]:pt-safe-top [@media(max-width:700px)]:[&>div]:pb-[max(20px,var(--safe-area-inset-bottom))]"
				>
					<Suspense fallback={null}>
						<EditionActivitySlogan />
					</Suspense>
					<div className="flex w-full items-center justify-end gap-2.5 p-5">
						<MacMenu className="mr-auto" />
						<LanguageSelect />
						<WindowMenu />
						{/* <AppearanceSwitch /> */}
					</div>
					<div className="flex w-full flex-1 flex-col items-center [@media(max-width:768px)]:gap-5">
						<TopMeta />
						<div
							className={cn(
								"z-[1] my-auto flex h-fit w-[600px] flex-col items-center rounded-[12px] border border-border bg-background p-10",
								// Embedded login containers can be narrower than a phone's screen width.
								"[@media(max-width:400px)]:px-5 [@media(max-width:700px)]:!mt-2.5 [@media(max-width:700px)]:w-full [@media(max-width:700px)]:min-w-0 [@media(max-width:700px)]:max-w-full [@media(max-width:700px)]:overflow-hidden [@media(max-width:700px)]:border-0 [@media(max-width:700px)]:bg-transparent [@media(max-width:700px)]:px-[30px] [@media(max-width:700px)]:py-5",
								"[@media(min-height:1000px)]:mt-[150px]",
								loginFormClassName,
							)}
						>
							<Outlet />
						</div>
					</div>
					<Copyright />
				</ScrollArea>
			</div>
		</AnimatedGridPattern>
	)
}

export default withLoginService(
	function SSOLayout() {
		return <Layout />
	},
	{
		service,
		syncFromGlobalClusterCode: true,
	},
)
