import { useContext } from "react"
import { MagicCitationContext } from "./Provider"

export const useMagicCitationSources = () => {
	return useContext(MagicCitationContext)
}
