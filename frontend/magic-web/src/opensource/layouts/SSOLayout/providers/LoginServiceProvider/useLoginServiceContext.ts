import { useContext } from "react"
import { LoginServiceContext } from "./LoginServiceProvider"

export function useLoginServiceContext() {
	return useContext(LoginServiceContext)
}
