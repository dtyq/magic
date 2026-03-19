/**
 * 预加载话题页
 * @param isMobile 是否是移动端
 * @returns 预加载话题页
 */
export const preloadTopicPage = () => {
	return import("../index.desktop")
}
