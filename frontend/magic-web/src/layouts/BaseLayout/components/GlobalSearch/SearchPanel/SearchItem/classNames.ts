// Shared result appearance; avatar URLs and other result-dependent values remain runtime props.
export const searchItemClassNames = {
	item: "relative flex h-auto w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:bg-border before:content-[''] hover:bg-primary/[0.12] hover:before:bg-transparent active:bg-primary/[0.16] active:before:bg-transparent last:before:hidden dark:hover:bg-primary/[0.28] dark:active:bg-primary/[0.36]",
	icon: "m-0.5 flex size-9 flex-none items-center justify-center rounded bg-[#f0f0f0] bg-cover bg-center bg-no-repeat text-white",
	wrapper: "flex h-full flex-auto flex-col justify-center gap-0.5 overflow-hidden",
	title: "h-5 truncate text-sm font-normal not-italic leading-5 text-foreground",
	breadcrumb: "![--magic-breadcrumb-separator-margin:4px]",
	desc: "h-4 truncate text-xs font-normal not-italic leading-4",
	text0: "text-foreground",
	text1: "text-foreground/80",
	text2: "text-foreground/60",
	text3: "text-foreground/40",
}
