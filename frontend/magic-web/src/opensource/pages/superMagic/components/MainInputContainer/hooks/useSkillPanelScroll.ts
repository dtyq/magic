import { useEffect, RefObject } from "react"
import { reaction } from "mobx"
import { SceneStateStore } from "../stores/SceneStateStore"
import { useOptionalSceneStateStore } from "../stores"

/**
 * 技能面板自动滚动 Hook
 * 当技能配置加载完成后，自动滚动到技能面板
 */
export function useSkillPanelScroll(
	editorContainerRef: RefObject<HTMLDivElement>,
	store?: SceneStateStore,
) {
	const contextStore = useOptionalSceneStateStore()
	const sceneStateStore = store ?? contextStore

	useEffect(() => {
		if (!sceneStateStore) return

		return reaction(
			() => sceneStateStore.currentScene,
			(scene) => {
				if (!scene || !editorContainerRef.current) return

				const scrollToView = () => {
					editorContainerRef.current?.scrollIntoView({
						behavior: "smooth",
						block: "start",
					})
				}

				// 检查当前技能是否有待处理的配置请求
				const pendingRequest = sceneStateStore.pendingRequest

				if (sceneStateStore.currentSceneConfig) {
					// 配置已缓存，立即滚动到视图
					requestAnimationFrame(() => {
						scrollToView()
					})
				} else if (pendingRequest) {
					// 等待待处理的请求完成后再滚动
					pendingRequest.then(() => {
						scrollToView()
					})
				}
			},
		)
	}, [editorContainerRef, sceneStateStore])
}
