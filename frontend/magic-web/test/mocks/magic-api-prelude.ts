/**
 * 生产环境的 Vite 插件会在构建时生成这个虚拟模块。
 * 单元测试不会执行 iframe prelude，因此使用空脚本即可，避免测试依赖仅构建阶段可用的插件。
 */
const magicApiPreludeScript = ""

export default magicApiPreludeScript
