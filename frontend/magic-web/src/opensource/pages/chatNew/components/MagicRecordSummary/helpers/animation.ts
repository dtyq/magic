export const createAnimation = (loaderName: string, frames: string, suffix: string): string => {
	const animationName = `react-spinners-${loaderName}-${suffix}`

	if (typeof window === "undefined" || !window.document) {
		return animationName
	}

	const styleEl = document.createElement("style")
	document.head.appendChild(styleEl)
	const styleSheet = styleEl.sheet

	const keyFrames = `
      @keyframes ${animationName} {
        ${frames}
      }
    `

	if (styleSheet) {
		styleSheet.insertRule(keyFrames, 0)
	}

	return animationName
}
