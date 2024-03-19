import type { FlowStoreState } from "@/opensource/stores/flow"
import { createContext } from "react"

export const flowStoreContext = createContext<FlowStoreState | null>(null)
