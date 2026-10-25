import { createContext, useContext } from "react"
import type { FoldedToolAttempt } from "./folded-tool-runs"

const NO_RUNS: ReadonlyMap<string, FoldedToolAttempt[]> = new Map()

/** Folded failure runs of the rendered list, keyed by their lead tool call id. */
export const FoldedToolRunsContext =
	createContext<ReadonlyMap<string, FoldedToolAttempt[]>>(NO_RUNS)

/** Every attempt of the run this tool call leads, or undefined when it leads none. */
export function useFoldedToolRun(toolCallId: string | undefined): FoldedToolAttempt[] | undefined {
	const runs = useContext(FoldedToolRunsContext)
	return toolCallId ? runs.get(toolCallId) : undefined
}
