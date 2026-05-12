import { Fragment, StrictMode, type PropsWithChildren } from "react"

const DISABLE_STRICT_MODE_QUERY_KEY = "__disable_strict_mode"

function shouldDisableStrictModeInDev() {
	if (!import.meta.env.DEV) return false
	return new URLSearchParams(window.location.search).get(DISABLE_STRICT_MODE_QUERY_KEY) === "1"
}

export function DevStrictMode({ children }: PropsWithChildren) {
	const Wrapper = shouldDisableStrictModeInDev() ? Fragment : StrictMode
	return <Wrapper>{children}</Wrapper>
}

export { DISABLE_STRICT_MODE_QUERY_KEY }
