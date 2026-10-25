// 按需加载方式
export const loadKaTeX = () => import("katex")

// 同时加载 CSS
export const loadKaTeXCSS = () => import("katex/dist/katex.min.css")

export default loadKaTeX
