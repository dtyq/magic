/**
 * 处理节点布局相关
 */
import { fitViewRatio } from "@/MagicFlow/constants"
import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import {
	useFlowEdges,
	useFlowNodes,
	useNodeConfig,
	useNodeConfigActions,
} from "@/MagicFlow/context/FlowContext/useFlow"
import { useNodes } from "@/MagicFlow/context/NodesContext/useNodes"
import { useResize } from "@/MagicFlow/context/ResizeContext/useResize"
import { EdgeModelTypes, defaultEdgeConfig } from "@/MagicFlow/edges"
import { MagicFlow } from "@/MagicFlow/types/flow"
import { handleRenderProps, isRegisteredStartNode } from "@/MagicFlow/utils"
import { generatePasteNodesAndEdges, getLayoutElements } from "@/MagicFlow/utils/reactflowUtils"
import {
	IconCapture,
	IconChevronDown,
	IconDeviceIpadHorizontal,
	IconDragDrop,
	IconLayout,
	IconLine,
	IconLock,
	IconLockOpen,
	IconMouse,
	IconRuler,
	IconVectorSpline,
	IconZoomIn,
	IconZoomOut,
} from "@tabler/icons-react"
import { useDebounceFn, useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import { Flex, Popover, message } from "antd"
import i18next from "i18next"
import _ from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Edge, useReactFlow, useStoreApi } from "reactflow"
import InteractionSelect, { Interactions } from "../components/InteractionSelect"
import useInteraction from "../components/InteractionSelect/useInteraction"
import styles from "../index.module.less"

export const controlDuration = 200

// 定义粘贴时第一个节点的左侧偏移量
const PASTE_LEFT_OFFSET = 200

interface FlowLayoutProps {
	setShowParamsComp: React.Dispatch<React.SetStateAction<boolean>>
	flowInstance: any
}

export default function useFlowLayout({ setShowParamsComp, flowInstance }: FlowLayoutProps) {
	const { t } = useTranslation()

	const { setEdges, edges } = useFlowEdges()
	const { nodeConfig } = useNodeConfig()
	const { setNodeConfig, notifyNodeChange } = useNodeConfigActions()
	const { processNodesBatch } = useFlowNodes()

	const { setNodes, nodes } = useNodes()

	const { zoomIn, zoomOut, fitView, getZoom, setViewport, getViewport } = useReactFlow()

	const { layoutOnMount, paramsName } = useExternalConfig()

	const [currentZoom, setCurrentZoom] = useState(getZoom())

	const { windowSize } = useResize()

	const [showMinMap, setShowMinMap] = useState(false)

	// 是否锁定视图
	const [isLock, setIsLock] = useState(false)

	// 边类型是否是贝塞尔曲线
	const [isBezier, setIsBezier] = useState(true)

	// 是否可以布局优化
	const [canLayout, setCanLayout, resetCanLayout] = useResetState(true)

	const store = useStoreApi()

	const [isMountLayout, setIsMountLayout] = useState(false)

	// 布局之前的数据
	const [lastLayoutData, setLastLayoutData, resetLastLayoutData] = useResetState({
		undoable: false,
		nodes: [] as MagicFlow.Node[],
		edges: [] as Edge[],
	})

	const { interaction, onInteractionChange, openInteractionSelect, setOpenInteractionSelect } =
		useInteraction()

	const updateConfigPosition = useMemoizedFn((layoutNodes: MagicFlow.Node[]) => {
		layoutNodes.forEach((n) => {
			const curNodeConfig = nodeConfig[n.node_id]
			_.set(curNodeConfig, ["meta", "position"], n.position)
			_.set(curNodeConfig, ["position"], n.position)
		})
	})

	const onLayout = useMemoizedFn((direction = "LR", duration = controlDuration) => {
		// 节点位置没发生任何变更，不需要布局
		if (!canLayout) return nodes

		// if is undo
		if (lastLayoutData.undoable) {
			setNodes([...lastLayoutData.nodes])
			setEdges([...lastLayoutData.edges])
			updateConfigPosition(lastLayoutData.nodes)

			resetLastLayoutData()
			setCanLayout(true)
			return lastLayoutData.nodes
		} else {
			const beforeNodes = _.cloneDeep(nodes)
			const beforeLayoutData = {
				undoable: true,
				nodes: beforeNodes,
				edges: _.cloneDeep(edges),
			}

			const { nodes: layoutNodes, edges: layoutEdges } = getLayoutElements(
				nodes,
				edges,
				direction,
				paramsName,
			)

			if (_.isEqual(layoutNodes, beforeNodes)) {
				setCanLayout(false)
				return nodes
			}
			updateConfigPosition(layoutNodes)

			// 记录布局前数据
			setLastLayoutData(beforeLayoutData)

			setNodes([...layoutNodes])
			setEdges([...layoutEdges])
			return layoutNodes
		}

		// 布局完成后进行一次视图自适应，避免布局后节点离开用户视线
		// setTimeout(() => {
		// 	fitView({ includeHiddenNodes: true, duration })
		// 	setCurrentZoom(getZoom())
		// }, 0)
	})

	const onFitView = useMemoizedFn(() => {
		// 超过阈值，通过骨架渲染，避免卡顿
		if (nodes.length >= fitViewRatio) {
			setShowParamsComp(false)
		}
		fitView({ includeHiddenNodes: true, duration: controlDuration })
		setTimeout(() => {
			setCurrentZoom(getZoom())
		}, controlDuration)
	})

	const onLock = useMemoizedFn(() => {
		store.setState({
			nodesDraggable: isLock,
			nodesConnectable: isLock,
			elementsSelectable: isLock,
		})
		setIsLock(!isLock)
	})

	const onZoomIn = useMemoizedFn((duration?: number) => {
		zoomIn({ duration: duration || controlDuration })
		setTimeout(() => {
			setCurrentZoom(getZoom())
		}, duration || controlDuration)
	})

	const onZoomOut = useMemoizedFn(() => {
		zoomOut({ duration: controlDuration })
		setTimeout(() => {
			setCurrentZoom(getZoom())
		}, controlDuration)
	})

	const { run: onMove } = useDebounceFn(
		useMemoizedFn(() => {
			setCurrentZoom(getZoom())
		}),
		{
			wait: 500,
		},
	)

	const onEdgeTypeChange = useMemoizedFn(() => {
		const currentIsBezier = !isBezier
		setIsBezier(currentIsBezier)

		// 修改默认配置的type
		defaultEdgeConfig.type = currentIsBezier
			? EdgeModelTypes.CommonEdge
			: EdgeModelTypes.SmoothStep

		const newEdges = edges.map((o) => ({
			...o,
			...defaultEdgeConfig,
		}))

		setEdges([...newEdges])
	})

	// 在hooks的状态部分添加辅助线控制状态
	const [helperLinesEnabled, setHelperLinesEnabled] = useState(false)

	// 操作栏列表
	const controlItemGroups = useMemo(() => {
		return [
			[
				{
					icon: (
						<Popover
							content={
								<InteractionSelect
									interaction={interaction}
									onInteractionChange={onInteractionChange}
								/>
							}
							showArrow={false}
							open={openInteractionSelect}
						>
							<Flex
								className={styles.interaction}
								align="center"
								onClick={(e) => {
									e.stopPropagation()
									setOpenInteractionSelect(!openInteractionSelect)
								}}
							>
								{interaction === Interactions.Mouse ? (
									<IconMouse stroke={1} />
								) : (
									<IconDeviceIpadHorizontal stroke={1} />
								)}
								<IconChevronDown stroke={1} />
							</Flex>
						</Popover>
					),
					callback: () => {
						setOpenInteractionSelect(!openInteractionSelect)
					},
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>
								{interaction === Interactions.Mouse
									? i18next.t("flow.mouseFriendly", { ns: "magicFlow" })
									: i18next.t("flow.touchpadFriendly", { ns: "magicFlow" })}
							</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>I</div>
						</Flex>
					),
				},
			],
			[
				{
					icon: <IconZoomOut stroke={1} />,
					callback: () => onZoomOut(),
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>{i18next.t("flow.zoomOut", { ns: "magicFlow" })}</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>-</div>
						</Flex>
					),
				},

				{
					icon: <div className={styles.scaleWrap}>{Math.ceil(currentZoom * 100)}%</div>,
					callback: () => {},
					isNotIcon: true,
				},
				{
					icon: <IconZoomIn stroke={1} />,
					callback: () => onZoomIn(),
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>{i18next.t("flow.zoomIn", { ns: "magicFlow" })}</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>+</div>
						</Flex>
					),
				},
			],
			[
				{
					icon: (
						<IconLayout
							stroke={1}
							className={lastLayoutData.undoable ? styles.undoLayoutItem : ""}
						/>
					),
					callback: () => onLayout("LR"),
					tooltips: lastLayoutData.undoable ? (
						i18next.t("flow.recallLayout", { ns: "magicFlow" })
					) : (
						<Flex justify="space-between" gap={4}>
							<span>{i18next.t("flow.layout", { ns: "magicFlow" })}</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>P</div>
						</Flex>
					),
				},
				{
					icon: <IconCapture stroke={1} />,
					callback: () => onFitView(),
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>{i18next.t("flow.adaptView", { ns: "magicFlow" })}</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>A</div>
						</Flex>
					),
				},
			],
			[
				{
					icon: isLock ? (
						<IconLock stroke={1} color="#FF7D00" />
					) : (
						<IconLockOpen stroke={1} />
					),
					callback: () => onLock(),
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>
								{isLock
									? i18next.t("flow.unlockView", { ns: "magicFlow" })
									: i18next.t("flow.lockView", { ns: "magicFlow" })}
							</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>L</div>
						</Flex>
					),
					isLock,
				},
			],
			[
				{
					icon: isBezier ? <IconVectorSpline stroke={1} /> : <IconLine stroke={1} />,
					callback: () => onEdgeTypeChange(),
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>
								{isBezier
									? i18next.t("flow.changeToPolygonLine", { ns: "magicFlow" })
									: i18next.t("flow.changeToSmoothLine", { ns: "magicFlow" })}
							</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>M</div>
						</Flex>
					),
				},
			],
			[
				{
					icon: <IconDragDrop stroke={1} />,
					callback: () => {
						setShowMinMap(!showMinMap)
					},
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>
								{showMinMap
									? i18next.t("flow.closeMinMap", { ns: "magicFlow" })
									: i18next.t("flow.openMinMap", { ns: "magicFlow" })}
							</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>D</div>
						</Flex>
					),
					showMinMap,
				},
			],
			[
				{
					icon: helperLinesEnabled ? (
						<IconRuler stroke={1} color="#FF7D00" />
					) : (
						<IconRuler stroke={1} />
					),
					callback: () => setHelperLinesEnabled(!helperLinesEnabled),
					tooltips: (
						<Flex justify="space-between" gap={4}>
							<span>
								{helperLinesEnabled
									? i18next.t("flow.disableHelperLines", {
											ns: "magicFlow",
											defaultValue: "禁用辅助线",
									  })
									: i18next.t("flow.enableHelperLines", {
											ns: "magicFlow",
											defaultValue: "启用辅助线",
									  })}
							</span>
							<div className={styles.shortCutsBlock}>
								{navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl"}
							</div>
							<div className={styles.shortCutsBlock}>H</div>
						</Flex>
					),
					helperLinesEnabled,
				},
			],
		]
	}, [
		currentZoom,
		isBezier,
		isLock,
		lastLayoutData.undoable,
		onEdgeTypeChange,
		onFitView,
		onLayout,
		onLock,
		onZoomIn,
		onZoomOut,
		showMinMap,
		openInteractionSelect,
		interaction,
		onInteractionChange,
		helperLinesEnabled,
	])

	useUpdateEffect(() => {
		if (isMountLayout) return
		if (nodes.length) {
			let node = nodes[0]

			// 只有node有宽度时，才被reactflow真正渲染，此时才可以进行布局
			if (!isMountLayout && node.width) {
				if (isRegisteredStartNode()) {
					if (nodes.length !== 1) setIsMountLayout(true)
				} else {
					setIsMountLayout(true)
				}
				/** 判断是否需要初始化时自动布局 */
				if (layoutOnMount) {
					const layoutNodes = onLayout("LR", 0)
					resetLastLayoutData()
					node = layoutNodes?.[0]
				}
				/** 设置画布中心为第一个节点中心 */
				setViewport({
					x: 100,
					// @ts-ignore
					y: -node?.position?.y - node?.height / 2 + windowSize.height / 2,
					zoom: 1,
				})
			}
		}
	}, [nodes, edges, isMountLayout, setViewport, windowSize, layoutOnMount])

	// 使用useEffect和低级事件监听替代所有快捷键
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// 检查元素是否在可编辑区域内，如果是则不处理快捷键
			const activeElement = document.activeElement
			if (
				activeElement?.tagName === "INPUT" ||
				activeElement?.tagName === "TEXTAREA" ||
				// @ts-ignore
				activeElement?.isContentEditable
			) {
				return
			}

			// 检测是否按下Cmd(Mac)或Ctrl(Windows)
			const isMetaPressed = e.metaKey || e.ctrlKey

			if (isMetaPressed) {
				switch (e.key.toLowerCase()) {
					// 缩小画布: Cmd/Ctrl + -
					case "-":
						e.preventDefault()
						e.stopPropagation()
						onZoomOut()
						break

					// 放大画布: Cmd/Ctrl + = 或 Cmd/Ctrl + +
					case "=":
					case "+":
						e.preventDefault()
						e.stopPropagation()
						onZoomIn()
						break

					// 优化布局: Cmd/Ctrl + P
					case "p":
						e.preventDefault()
						e.stopPropagation()
						onLayout("LR")
						break

					// 自适应视图: Cmd/Ctrl + A
					case "a":
						e.preventDefault()
						e.stopPropagation()
						onFitView()
						break

					// 锁定/解锁视图: Cmd/Ctrl + L
					case "l":
						e.preventDefault()
						e.stopPropagation()
						onLock()
						break

					// 切换线条样式: Cmd/Ctrl + M
					case "m":
						e.preventDefault()
						e.stopPropagation()
						onEdgeTypeChange()
						break

					// 切换交互模式: Cmd/Ctrl + I
					case "i":
						e.preventDefault()
						e.stopPropagation()
						onInteractionChange(
							interaction === Interactions.Mouse
								? Interactions.TouchPad
								: Interactions.Mouse,
						)
						break

					// 显示/隐藏小地图: Cmd/Ctrl + D
					case "d":
						e.preventDefault()
						e.stopPropagation()
						setShowMinMap(!showMinMap)
						break
				}
			}
		}

		// 将事件监听器添加到document而不是特定元素，确保无论焦点在哪里都能捕获到
		// 使用capture: true确保在事件传播链的最早阶段捕获
		document.addEventListener("keydown", handleKeyDown, { capture: true })

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true })
		}
	}, [
		onZoomIn,
		onZoomOut,
		onLayout,
		onFitView,
		onLock,
		onEdgeTypeChange,
		interaction,
		onInteractionChange,
		showMinMap,
	])

	// 在useKeyboardShortcuts或相关的键盘快捷键处理部分添加辅助线快捷键支持
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// 避免在输入框中触发快捷键
			if (
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA"
			) {
				return
			}

			// Ctrl+H 或 Command+H 切换辅助线功能
			if ((event.ctrlKey || event.metaKey) && event.key === "h") {
				event.preventDefault()
				setHelperLinesEnabled(!helperLinesEnabled)
			}

			// 其他快捷键处理...
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [helperLinesEnabled, setHelperLinesEnabled])

	const handlePaste = useMemoizedFn((e: any) => {
		// 获取活动元素，检查是否在输入框或可编辑区域
		const activeElement = document.activeElement
		if (
			activeElement?.tagName === "INPUT" ||
			activeElement?.tagName === "TEXTAREA" ||
			// @ts-ignore
			activeElement?.isContentEditable
		) {
			return
		}

		// 确保鼠标在ReactFlow画布上或其子元素上
		const reactFlowEl =
			flowInstance?.current?.querySelector(".react-flow") ||
			document.querySelector(".react-flow")
		if (!reactFlowEl) return

		// 检查点击位置是否在ReactFlow区域内
		const rect = reactFlowEl.getBoundingClientRect()
		if (
			e.clientX &&
			(e.clientX < rect.left ||
				e.clientX > rect.right ||
				e.clientY < rect.top ||
				e.clientY > rect.bottom)
		) {
			return
		}

		// 获取当前视图信息
		const { x: viewX, y: viewY, zoom } = getViewport()

		// 计算视图中心在流程图中的坐标
		const viewCenterX = (rect.width / 2 - viewX) / zoom
		const viewCenterY = (rect.height / 2 - viewY) / zoom

		// 计算视图左侧在流程图中的坐标
		const viewLeftX = (0 - viewX) / zoom

		navigator.clipboard.readText().then((text) => {
			try {
				const json = JSON.parse(text)
				if (json?.nodes && json?.edges) {
					const cacheConfig = {} as Record<string, MagicFlow.Node>
					const cacheNodes = [] as MagicFlow.Node[]
					const { pasteEdges, pasteNodes } = generatePasteNodesAndEdges(
						nodeConfig,
						json.nodes,
						json.edges,
						paramsName,
					)

					// 如果节点数组为空，则不处理
					if (pasteNodes.length === 0) return

					// 提取原始节点组的第一个节点位置作为参考
					const firstNodeOriginalPos = {
						x: pasteNodes[0].position.x,
						y: pasteNodes[0].position.y,
					}

					for (let i = 0; i < pasteNodes.length; i++) {
						let node = pasteNodes[i]
						delete node.data.icon
						node.selected = false

						// 计算相对于第一个节点的偏移
						const deltaX = node.position.x - firstNodeOriginalPos.x
						const deltaY = node.position.y - firstNodeOriginalPos.y

						// 获取第一个节点的宽高
						const firstNodeWidth = pasteNodes[0].width || 0
						const firstNodeHeight = pasteNodes[0].height || 0

						// 设置新位置：
						// 水平方向：基于当前视图左侧加上固定偏移量
						// 垂直方向：视图中心减去节点高度的一半，使其垂直居中
						// 注意：对所有节点都应用相同的偏移量，以保持它们之间的相对位置
						node.meta = {
							position: {
								x: viewLeftX + PASTE_LEFT_OFFSET + deltaX,
								y: viewCenterY - firstNodeHeight / 2 + deltaY,
							},
						}

						/** 处理节点渲染字段 */
						handleRenderProps(node, i, paramsName)

						cacheConfig[node.id] = node
						cacheNodes.push(node)
					}
					setNodeConfig({
						...nodeConfig,
						...cacheConfig,
					})
					// 只有节点为空才进入渐进式加载策略
					if (nodes.length === 0) {
						processNodesBatch([...nodes, ...cacheNodes], (nodes) => {
							setNodes(nodes)
						})
					} else {
						setNodes([...nodes, ...cacheNodes])
					}
					setEdges([...edges, ...pasteEdges])
					message.success(i18next.t("common.pasteSuccess", { ns: "magicFlow" }))
					notifyNodeChange?.()
				}
			} catch (e) {
				console.log("不符合格式要求", e)
			}
		})
	})

	useEffect(() => {
		// 在document级别监听paste事件，确保能捕获所有粘贴操作
		document.addEventListener("paste", handlePaste, { capture: true })

		return () => {
			document.removeEventListener("paste", handlePaste, { capture: true })
		}
	}, [handlePaste])

	return {
		controlItemGroups,
		lastLayoutData,
		resetLastLayoutData,
		resetCanLayout,
		layout: onLayout,
		setIsMountLayout,
		showMinMap,
		currentZoom,
		onMove,
		interaction,
		onFitView,
		onZoomIn,
		onZoomOut,
		onEdgeTypeChange,
		onLock,
		onInteractionChange,
		helperLinesEnabled,
	}
}
