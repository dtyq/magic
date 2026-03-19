import type { FlowStoreState } from "@/stores/flow"
import { createContext } from "react"

export const flowStoreContext = createContext<FlowStoreState | null>(null)
