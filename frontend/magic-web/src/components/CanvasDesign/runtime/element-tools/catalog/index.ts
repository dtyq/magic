/**
 * 工具定义目录的公共 surface 描述工厂。
 *
 * 具体元素能力按 image/video/audio/text/frame/shape/version/generation
 * 拆分时只依赖这里的可序列化 options，不把 React renderer 带入 runtime。
 */
export * from "./surfaceOptions"
export * from "./common"
export * from "./commonTools"
export * from "./generation"
export * from "./text"
export * from "./shape"
export * from "./version"
