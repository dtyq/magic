const appearanceClasses = {
	source: "!opacity-40",
	disabled: "!opacity-[0.45]",
	workspace: "!rounded-xl !bg-[#eef3fd] !shadow-[inset_0_0_0_2px_#81bfff]",
	collapsedWorkspace: "!rounded-lg !bg-[#eef3fd] !shadow-[inset_0_0_0_2px_#81bfff]",
	headerCollapsed: "!rounded-xl !bg-[#eef3fd] !shadow-[inset_0_0_0_2px_#81bfff]",
	headerSticky: "!bg-[#eef3fd] !shadow-[inset_2px_0_0_0_#81bfff,inset_-2px_0_0_0_#81bfff]",
	headerExpanded:
		"!rounded-t-xl !rounded-b-none !bg-[#eef3fd] !shadow-[inset_0_2px_0_0_#81bfff,inset_2px_0_0_0_#81bfff,inset_-2px_0_0_0_#81bfff]",
	transparent: "!bg-transparent",
} as const

// Remember only classes introduced by this drag so cleanup preserves the component's own classes.
const addedClasses = new WeakMap<HTMLElement, string[]>()

export function clearSidebarDragAppearance(element: HTMLElement | null | undefined) {
	if (!element) return
	const classes = addedClasses.get(element)
	if (classes?.length) element.classList.remove(...classes)
	addedClasses.delete(element)
}

/** Keep inset outlines instead of borders, which would shift measured drop targets. */
export function setSidebarDragAppearance(
	element: HTMLElement | null | undefined,
	appearance: keyof typeof appearanceClasses,
) {
	if (!element) return
	clearSidebarDragAppearance(element)
	const classes = appearanceClasses[appearance]
		.split(" ")
		.filter((name) => !element.classList.contains(name))
	if (classes.length) element.classList.add(...classes)
	addedClasses.set(element, classes)
}
