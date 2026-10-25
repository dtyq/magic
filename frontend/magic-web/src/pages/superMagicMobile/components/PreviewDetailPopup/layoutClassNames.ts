import { cn } from "@/utils/cn"

/** Keep the mobile preview within the safe viewport while filling the available height. */
export const MOBILE_PREVIEW_SHEET_CLASSNAME = cn(
	"flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-background p-0",
	"!h-[98dvh] !max-h-[calc(100dvh-var(--safe-area-inset-top)-0.5rem)]",
	"data-[vaul-drawer-direction=bottom]:!mt-[max(0.5rem,var(--safe-area-inset-top))]",
)

export const MOBILE_PREVIEW_BODY_CLASSNAME =
	"flex min-h-0 flex-1 flex-col !max-h-none overflow-hidden !overflow-hidden bg-background p-0"
export const PREVIEW_MOBILE_FULLSCREEN_CLASSNAME =
	"!h-[100dvh] !max-h-none !rounded-none data-[vaul-drawer-direction=bottom]:!mt-0"
export const PREVIEW_SHARE_CONTAINER_CLASSNAME = "w-full overflow-hidden"
export const PREVIEW_SHARE_IMMERSIVE_CLASSNAME =
	"fixed inset-0 z-[1101] !mt-0 h-[100dvh] w-screen overflow-hidden bg-transparent"
export const PREVIEW_MODAL_CLASSNAME = "!w-[80vw]"
export const PREVIEW_MODAL_FULLSCREEN_CLASSNAME =
	"!top-0 !left-0 !right-0 !m-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !pb-0"
export const PREVIEW_MODAL_CONTENT_FULLSCREEN_CLASSNAME =
	"!flex !h-[100dvh] !max-h-[100dvh] flex-col overflow-hidden !rounded-none"
export const PREVIEW_MODAL_BODY_CLASSNAME = "!h-[80vh] !w-[80vw] !p-0 overflow-hidden rounded-b-xl"
export const PREVIEW_MODAL_BODY_FULLSCREEN_CLASSNAME = "!h-full !w-full !max-h-none !rounded-none"
export const PREVIEW_MODAL_BODY_WRAPPER_CLASSNAME =
	"flex h-full flex-auto flex-col overflow-x-hidden overflow-y-auto"
export const PREVIEW_MOBILE_BOTTOM_GAP_CLASSNAME = "!pb-[calc(56px+var(--safe-area-inset-bottom))]"
