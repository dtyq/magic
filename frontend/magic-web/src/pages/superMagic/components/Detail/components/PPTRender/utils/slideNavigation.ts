interface SlidePathLike {
	path: string
}

function normalizePath(path: string): string {
	const normalized: string[] = []
	for (const segment of path.replace(/\\/g, "/").split("/")) {
		if (!segment || segment === ".") continue
		if (segment === "..") normalized.pop()
		else normalized.push(segment)
	}
	return normalized.join("/")
}

/** Finds a target slide from a relative project file link. */
export function findPPTSlideIndex(
	slides: readonly SlidePathLike[],
	currentSlidePath: string,
	href: string,
): number {
	const trimmedHref = href.trim()
	if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmedHref)) return -1
	let rawPath = trimmedHref.split(/[?#]/, 1)[0]
	try {
		rawPath = decodeURIComponent(rawPath)
	} catch {
		return -1
	}
	if (!rawPath) return -1
	// The HTML navigation runtime resolves file links to project-root paths.
	if (rawPath.startsWith("/")) {
		return slides.findIndex((slide) => normalizePath(slide.path) === normalizePath(rawPath))
	}

	const currentPath = normalizePath(currentSlidePath)
	const currentFolder = currentPath.includes("/")
		? currentPath.slice(0, currentPath.lastIndexOf("/") + 1)
		: ""
	const relativePath = normalizePath(`${currentFolder}${rawPath}`)
	const relativeIndex = slides.findIndex((slide) => normalizePath(slide.path) === relativePath)
	if (relativeIndex >= 0) return relativeIndex

	// Keep project-root paths as a compatibility fallback for existing generated decks.
	const projectRootPath = normalizePath(rawPath)
	return slides.findIndex((slide) => normalizePath(slide.path) === projectRootPath)
}

/** Store file identity rather than page numbers so slide reordering keeps links intact. */
export function getPPTSlideHref(currentSlidePath: string, targetSlidePath: string): string {
	const currentFolder = normalizePath(currentSlidePath).split("/").slice(0, -1)
	const target = normalizePath(targetSlidePath).split("/")
	while (currentFolder.length && target.length && currentFolder[0] === target[0]) {
		currentFolder.shift()
		target.shift()
	}
	return [...currentFolder.map(() => ".."), ...target.map(encodeURIComponent)].join("/")
}
