// 按需加载方式
export const loadJSZip = () => import("jszip").then((m) => m.default)

export default loadJSZip
