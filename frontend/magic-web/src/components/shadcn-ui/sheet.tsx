// PROJECT OVERRIDE — overlayClassName, showClose, @radix/react-dialog import.
import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import { cn } from "@/lib/utils"
import type { OverlayZIndexScope } from "@/utils/overlayZIndex/overlayStackManager"

interface SheetRootContextValue {
	open: boolean
}

const SheetRootContext = React.createContext<SheetRootContextValue | null>(null)

/** 包装 Radix Sheet Root 并透出 open 状态，供内容层按真实退场时机管理全局 z-index。 */
const Sheet = ({
	open,
	defaultOpen,
	onOpenChange,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) => {
	const isControlled = open !== undefined
	const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
	const actualOpen = isControlled ? open : internalOpen

	return (
		<SheetRootContext.Provider value={{ open: actualOpen }}>
			<SheetPrimitive.Root
				data-slot="sheet"
				open={open}
				defaultOpen={defaultOpen}
				onOpenChange={(nextOpen) => {
					if (!isControlled) {
						setInternalOpen(nextOpen)
					}
					onOpenChange?.(nextOpen)
				}}
				{...props}
			/>
		</SheetRootContext.Provider>
	)
}

// 用 `Object.assign` 保留 `forwardRef` 组件类型，同时稳定挂载 `displayName` 静态属性。
const SheetTrigger = Object.assign(
	React.forwardRef<
		React.ElementRef<typeof SheetPrimitive.Trigger>,
		React.ComponentPropsWithoutRef<typeof SheetPrimitive.Trigger>
	>(({ className, ...props }, ref) => (
		<SheetPrimitive.Trigger
			ref={ref}
			data-slot="sheet-trigger"
			className={cn(className)}
			{...props}
		/>
	)),
	{ displayName: "SheetTrigger" },
)

const SheetClose = Object.assign(
	React.forwardRef<
		React.ElementRef<typeof SheetPrimitive.Close>,
		React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
	>(({ ...props }, ref) => <SheetPrimitive.Close data-slot="sheet-close" ref={ref} {...props} />),
	{ displayName: "SheetClose" },
)

const SheetPortal = ({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) => (
	<SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
)

const SheetOverlay = Object.assign(
	React.forwardRef<
		React.ElementRef<typeof SheetPrimitive.Overlay>,
		React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
	>(({ className, ...props }, ref) => (
		<SheetPrimitive.Overlay
			data-slot="sheet-overlay"
			className={cn(
				// 高于 `MobileShellScaffold`（z-[1000]），否则 Portal 到 body 的 Sheet 会被全屏壳层挡住
				"fixed inset-0 z-[1100] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				className,
			)}
			{...props}
			ref={ref}
		/>
	)),
	{ displayName: "SheetOverlay" },
)

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
	side?: "top" | "right" | "bottom" | "left"
	showClose?: boolean
	overlayClassName?: string
	overlayStyle?: React.CSSProperties
	zIndex?: number
	zIndexScope?: OverlayZIndexScope
	zIndexManaged?: boolean
}

const SheetContent = Object.assign(
	React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
		(
			{
				className,
				children,
				side = "right",
				showClose = true,
				overlayClassName,
				overlayStyle,
				zIndex,
				zIndexScope = "global",
				zIndexManaged = true,
				style,
				onAnimationEnd,
				...props
			},
			ref,
		) => {
			const rootContext = React.useContext(SheetRootContext)
			const shouldManageZIndex = zIndexManaged === true
			const overlayLayer = useOverlayZIndex({
				open: shouldManageZIndex ? (rootContext?.open ?? false) : false,
				zIndex,
				zIndexScope,
				zIndexManaged: shouldManageZIndex,
			})

			/** 仅在退场动画结束后释放 Sheet 层级，避免嵌套 Sheet 在过渡期复用旧层级。 */
			const handleContentAnimationEnd: React.AnimationEventHandler<HTMLDivElement> = (
				event,
			) => {
				if (
					event.target === event.currentTarget &&
					shouldManageZIndex &&
					!rootContext?.open
				) {
					overlayLayer.releaseOverlayZIndex()
				}

				onAnimationEnd?.(event)
			}

			const resolvedOverlayStyle = shouldManageZIndex
				? {
						...overlayStyle,
						zIndex: overlayLayer.overlayZIndex,
					}
				: overlayStyle

			const resolvedContentStyle = shouldManageZIndex
				? {
						...style,
						zIndex: overlayLayer.contentZIndex,
					}
				: style

			return (
				<SheetPortal>
					<SheetOverlay className={overlayClassName} style={resolvedOverlayStyle} />
					<SheetPrimitive.Content
						ref={ref}
						data-slot="sheet-content"
						className={cn(
							"fixed z-[1100] flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
							(side === "right" || side === "left" || side === "bottom") &&
								"!pb-[var(--safe-area-inset-bottom)]",
							side === "right" &&
								"inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
							side === "left" &&
								"inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
							side === "top" &&
								"inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
							side === "bottom" &&
								"inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
							className,
						)}
						style={resolvedContentStyle}
						onAnimationEnd={handleContentAnimationEnd}
						{...props}
					>
						{children}
						{showClose && (
							<SheetPrimitive.Close className="focus:outline-hidden absolute right-4 top-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
								<XIcon className="size-4" />
								<span className="sr-only">Close</span>
							</SheetPrimitive.Close>
						)}
					</SheetPrimitive.Content>
				</SheetPortal>
			)
		},
	),
	{ displayName: "SheetContent" },
)

const SheetHeader = Object.assign(
	React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
		({ className, ...props }, ref) => (
			<div
				ref={ref}
				data-slot="sheet-header"
				className={cn("flex flex-col gap-1.5 p-4", className)}
				{...props}
			/>
		),
	),
	{ displayName: "SheetHeader" },
)

const SheetFooter = Object.assign(
	React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
		({ className, ...props }, ref) => (
			<div
				ref={ref}
				data-slot="sheet-footer"
				className={cn("mt-auto flex flex-col gap-2 p-4", className)}
				{...props}
			/>
		),
	),
	{ displayName: "SheetFooter" },
)

const SheetTitle = Object.assign(
	React.forwardRef<
		React.ElementRef<typeof SheetPrimitive.Title>,
		React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
	>(({ className, ...props }, ref) => (
		<SheetPrimitive.Title
			ref={ref}
			data-slot="sheet-title"
			className={cn("font-semibold text-foreground", className)}
			{...props}
		/>
	)),
	{ displayName: "SheetTitle" },
)

const SheetDescription = Object.assign(
	React.forwardRef<
		React.ElementRef<typeof SheetPrimitive.Description>,
		React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
	>(({ className, ...props }, ref) => (
		<SheetPrimitive.Description
			ref={ref}
			data-slot="sheet-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	)),
	{ displayName: "SheetDescription" },
)

export {
	Sheet,
	SheetTrigger,
	SheetClose,
	SheetPortal,
	SheetOverlay,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
}
