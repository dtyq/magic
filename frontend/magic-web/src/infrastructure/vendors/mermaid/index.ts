// 按需加载方式
export const loadMermaid = () => import("mermaid").then((m) => m.default)

export type { MermaidConfig, RenderResult } from "mermaid"

export default loadMermaid
