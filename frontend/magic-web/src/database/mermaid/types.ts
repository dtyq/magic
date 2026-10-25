import Dexie from "dexie"
import { RenderResult } from "@/infrastructure/vendors/mermaid"

export interface MermaidDb extends Dexie {
	mermaid: Dexie.Table<
		{
			data: string
			png: string
		} & RenderResult
	>
}
