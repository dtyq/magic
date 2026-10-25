import { useContext } from "react"
import { LoginServiceContext, type LoginServiceStore } from "./LoginServiceProvider"

export function useLoginServiceContext(): LoginServiceStore {
	return useContext(LoginServiceContext)
}
