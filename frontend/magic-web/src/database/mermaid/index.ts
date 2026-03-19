import Dexie from "dexie"
import { MermaidDb } from "./types"

export const MermaidDbName = "mermaid-svg-cache"

export const initMermaidDb = () => {
	const db = new Dexie(MermaidDbName) as MermaidDb

	db.version(1).stores({
		mermaid: "&data",
	})

	return db
}
