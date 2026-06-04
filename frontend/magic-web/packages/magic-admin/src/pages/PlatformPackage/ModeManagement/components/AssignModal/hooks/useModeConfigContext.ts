import { useContext } from "react"
import { ModeConfigContext } from "../context/ModeConfigContext"

export function useModeConfigContext() {
	const context = useContext(ModeConfigContext)

	if (!context) {
		throw new Error("useModeConfigContext must be used within ModeConfigProvider")
	}

	return context
}
