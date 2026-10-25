// Each result panel owns a ScrollArea viewport; headers and filters stay outside its scroll flow.
export const panelClassNames = {
	panel: "flex h-full min-h-0 gap-2.5 p-3",
	container: "flex h-full min-h-0 min-w-0 flex-auto flex-col overflow-hidden rounded-lg",
	header: "flex h-10 w-full flex-none items-center border-b border-border px-3 text-foreground/80",
	wrapper: "min-h-0 w-full flex-auto",
	title: "text-base font-semibold not-italic leading-[22px]",
	section:
		"flex h-full min-h-0 flex-[0_0_220px] flex-col gap-3.5 overflow-hidden rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900",
	sectionBody:
		"min-h-0 flex-1 [&_.magic-form-item-label]:text-sm [&_.magic-form-item-label]:font-semibold [&_.magic-form-item-label]:leading-5 [&_.magic-form-item]:mb-3",
	empty: "flex min-h-[220px] w-full flex-col items-center justify-center",
}
