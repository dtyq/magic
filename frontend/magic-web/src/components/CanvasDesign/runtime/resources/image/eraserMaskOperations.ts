import type { EraserStrokeMode } from "../../interaction/eraser/EraserRenderer"

/** 最终 mask 中白色表示擦除，黑色表示保留；恢复笔划因此覆盖回黑色。 */
export function getEraserMaskStrokeStyle(mode: EraserStrokeMode): "#fff" | "#000" {
	return mode === "restore" ? "#000" : "#fff"
}
