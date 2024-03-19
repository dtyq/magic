import { CanvasDocument } from "@/opensource/components/CanvasDesign/canvas/types"

export interface DesignData {
	type: "design" | string
	name: string
	version: string
	canvas?: CanvasDocument
}
