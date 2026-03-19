// Global fullscreen styles for xgplayer
const globalFullscreenStyles = `
.xgplayer:fullscreen,
.xgplayer:-webkit-full-screen,
.xgplayer:-moz-full-screen,
.xgplayer:-ms-fullscreen {
	width: 100vw !important;
	height: 100vh !important;
	background-color: #000 !important;
}

.xgplayer:fullscreen .xgplayer-video,
.xgplayer:-webkit-full-screen .xgplayer-video,
.xgplayer:-moz-full-screen .xgplayer-video,
.xgplayer:-ms-fullscreen .xgplayer-video {
	width: 100% !important;
	height: 100% !important;
	object-fit: contain !important;
}
`

// Inject global styles for fullscreen support
export const injectFullscreenStyles = (): void => {
	if (typeof document !== "undefined") {
		// Check if styles are already injected
		const existingStyle = document.getElementById("xgplayer-fullscreen-styles")
		if (existingStyle) return

		const styleElement = document.createElement("style")
		styleElement.id = "xgplayer-fullscreen-styles"
		styleElement.textContent = globalFullscreenStyles
		document.head.appendChild(styleElement)
	}
}
