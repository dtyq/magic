/* eslint-disable @typescript-eslint/naming-convention */
import { useMemoizedFn, useMount, useResetState, useUpdateEffect } from "ahooks"
import clsx from "clsx"
import { cloneDeep, endsWith, last } from "lodash"
import React, {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react"
import { ExpressionMode, KeyCodeMap, TextAreaModeTrigger } from "../constant"
import { useGlobalContext } from "../context/GlobalContext/useGlobalContext"
import { useTextareaModeContext } from "../context/TextareaMode/useTextareaModeContext"
import { SnowflakeId, checkIsAllDollarWrapped } from "../helpers"
import { Edit } from "../style"
import {
	CursorRef,
	EXPRESSION_ITEM,
	EXPRESSION_VALUE,
	EditRef,
	LabelTypeMap,
	type ChangeRef,
} from "../types"
import { transferSpecialSign } from "../utils"
import useEncryption from "./hooks/useEncryption"
import useExtraClassname from "./hooks/useExtraClassname"
import useSelectionChange from "./hooks/useSelectionChange"
import LabelCheckbox from "./nodes/LabelCheckbox/LabelCheckbox"
import LabelDatetime from "./nodes/LabelDatetime/LabelDatetime"
import LabelDepartmentNames from "./nodes/LabelDepartmentNames/LabelDepartmentNames"
import { LabelFunc } from "./nodes/LabelFunc/LabelFunc"
import LabelMember from "./nodes/LabelMember/LabelMember"
import LabelMultiple from "./nodes/LabelMultiple/LabelMultiple"
import LabelNames from "./nodes/LabelNames/LabelNames"
import { LabelNode } from "./nodes/LabelNode/LabelNode"
import { LabelPassword } from "./nodes/LabelPassword/LabelPassword"
import LabelSelect from "./nodes/LabelSelect/LabelSelect"
import { LabelTextBlock } from "./nodes/LabelText/LabelText"

const { LabelText } = LabelTypeMap

const getSpaceText = () => {
	return { type: LabelText, uniqueId: SnowflakeId(), value: "\u200B" } as EXPRESSION_ITEM
}
const LabelTypes = [
	LabelTypeMap.LabelNode,
	LabelTypeMap.LabelFunc,
	LabelTypeMap.LabelMember,
	LabelTypeMap.LabelMultiple,
	LabelTypeMap.LabelDateTime,
	LabelTypeMap.LabelSelect,
	LabelTypeMap.LabelCheckbox,
	LabelTypeMap.LabelDepartmentNames,
	LabelTypeMap.LabelNames,
]
const ALL_TYPE = [...Object.values(LabelTypeMap)]

export interface EditChangeRef {
	onLabelValueChange: (uniqueId: string, labelValue: EXPRESSION_ITEM) => void
	getDataSource: () => any
	setCurrentNod: (val: any) => void
	getCurrentNode: () => any
}

export interface KeeboardEditRef extends HTMLDivElement {
	onkeydown: (e: any) => void
	onkeyup: (e: any) => void
}

interface ContentEditableProps {
	changeRef: React.MutableRefObject<ChangeRef>
	bordered: boolean
	mode: ExpressionMode
	minHeight?: string
	setPosition: React.Dispatch<
		React.SetStateAction<{
			left: number
			top: number
		}>
	>
	inputRef: React.RefObject<HTMLDivElement>
}

const ContentEditable = (
	{ changeRef, bordered = true, mode, minHeight, setPosition, inputRef }: ContentEditableProps,
	ref: EditRef,
) => {
	const { disabled, showMultipleLine, zoom, selectPanelOpen, isInFlow } = useGlobalContext()
	const { openSelectPanel } = useTextareaModeContext()
	const [displayValue, setDisplayValue, resetDisplayValues] = useResetState<EXPRESSION_ITEM[]>([
		getSpaceText(),
	])
	const [editKey, setEditKey] = useState(new Date().valueOf())
	const [selectedNode, setSelectedNode] = useState("") // 当前选中的节点数据(除文本节点外)

	const editRef = useRef({} as KeeboardEditRef)
	const cursorRef = useRef({} as CursorRef)
	const editChangeRef = useRef({} as EditChangeRef) // 提供给子组件间容器方法

	const isResetCursor = useRef(false) // 是否重置光标
	const isEntering = useRef(false) // 是否正在拼音输入

	const isKeyDown = useRef(false) // 是否键按下 长按连续输入的时候用到
	const isExistNoUpdate = useRef(false) // 是否存在没更新的内容

	const newValue = useRef([] as EXPRESSION_VALUE[]) // 当前可编辑div里面最新应用的数据
	const currentNodes = useRef([] as EXPRESSION_VALUE[]) // 当前可编辑div里面所有节点数据

	const { extraClassname, makeCanScroll, banScroll } = useExtraClassname()

	const computedZoom = useMemo(() => {
		if (!isInFlow) return 1
		return zoom
	}, [isInFlow, zoom])

	const { handleFocusWhenEncryption } = useEncryption({
		clearDisplayValues: resetDisplayValues,
		displayValue,
		setDisplayValue,
	})

	const getItemType = useMemoizedFn((typeString = "") => {
		const types = Object.values(LabelTypeMap)
		return types.find((type) => typeString.includes(type))
	})

	const setCursor: EditRef["setCursor"] = useMemoizedFn(({ id, type, offset }) => {
		cursorRef.current = {
			id,
			type,
			offset,
		}

		if (id) {
			const index = displayValue.findIndex((item) => item.uniqueId === id)
			cursorRef.current.prevId = displayValue[index - 1]?.uniqueId
			cursorRef.current.nextId = displayValue[index + 1]?.uniqueId
		}
	})

	const checkIfScrollable = useMemoizedFn(() => {
		const scrollHeight =
			inputRef?.current?.getElementsByClassName("editable-container")[0]?.scrollHeight || 0
		const clientHeight =
			inputRef?.current?.getElementsByClassName("editable-container")[0]?.clientHeight || 0
		return scrollHeight > clientHeight
	})

	const setCurrentCursor = useMemoizedFn((e?: any) => {
		if (e) {
			// 可滚动，才加nowheel
			if (checkIfScrollable()) makeCanScroll()
		}
		handleFocusWhenEncryption()
		// 处理单击节点时
		const sel = window.getSelection && window.getSelection()
		const { id, type } = e?.target?.dataset || {}
		const itemType = getItemType(type || "") as LabelTypeMap

		const scrollTop =
			// @ts-ignore
			inputRef?.current?.getElementsByClassName("editable-container")[0]?.scrollTop || 0
		if ([LabelTypeMap.LabelNode, LabelTypeMap.LabelFunc].includes(itemType)) {
			const cascaderRect = editRef?.current?.getBoundingClientRect?.()
			const range = e.target?.getBoundingClientRect?.()

			setPosition({
				left: (range.left - cascaderRect.left + 10) / computedZoom,
				top: (range.top - cascaderRect.top) / computedZoom + 24 - scrollTop,
			})
			setSelectedNode(id)
			return
		}
		setSelectedNode("")

		if (sel && sel.rangeCount > 0) {
			const dom = sel?.getRangeAt?.(0)
			// @ts-ignore
			const { id, type } = dom?.endContainer?.parentNode?.dataset || {}
			const offset = dom?.endOffset
			setCursor({ id, type, offset })
		}
	})

	const cursorMoveToSpecifyPosition = useCallback(() => {
		if (!isResetCursor.current) return
		isResetCursor.current = false
		const { id, prevId, nextId } = cursorRef.current || {}
		let { offset } = cursorRef.current || {}
		const val = displayValue.find((item) => item.uniqueId === id)

		const selection = window.getSelection()

		let dom = null
		if (id) dom = document.getElementById(id)
		if (!dom && prevId) {
			const index = displayValue.findIndex((item) => item.uniqueId === prevId)
			if (index >= 0) {
				if (LabelTypes.includes(displayValue[index].type)) {
					dom = document.getElementById(displayValue[index + 1].uniqueId)
					offset = 0
				} else {
					dom = document.getElementById(displayValue[index].uniqueId)
					offset = -1
				}
			}
		}
		if (!dom && nextId) {
			const index = displayValue.findIndex((item) => item.uniqueId === nextId)
			if (index >= 0) {
				const itemType = getItemType(displayValue[index].type) as LabelTypeMap
				if (LabelTypes.includes(itemType)) {
					dom = document.getElementById(displayValue[index - 1].uniqueId)
					offset = -1
				} else {
					dom = document.getElementById(displayValue[index].uniqueId)
					offset = 0
				}
			}
		}

		// 保底光标移到最后
		if (!dom) {
			const { uniqueId } = last(displayValue) || { uniqueId: "" }
			dom = document.getElementById(uniqueId)
			offset = -1
		}

		const rangeText = dom?.lastChild

		// @ts-ignore
		if (!rangeText || (val && val.value !== rangeText?.data)) return
		if (offset < 0) {
			// @ts-ignore
			const strLen = rangeText.data.length
			if (strLen + (offset + 1) > 0) offset = strLen + (offset + 1)
		}

		const range = document.createRange()
		try {
			range?.setStart?.(rangeText, offset)
			range?.setEnd?.(rangeText, offset)
			// @ts-ignore
			selection?.removeAllRanges?.()
			// @ts-ignore
			selection?.addRange?.(range)
		} catch (e) {}
		setCurrentCursor()
	}, [displayValue, getItemType, setCurrentCursor])

	useEffect(() => {
		cursorMoveToSpecifyPosition()
	}, [cursorMoveToSpecifyPosition])

	const updateDisplayValue: EditRef["updateDisplayValue"] = useMemoizedFn((val) => {
		setEditKey(new Date().valueOf())
		newValue.current = cloneDeep(val)
		const values = []
		// @ts-ignore
		val.forEach((item) => {
			item.uniqueId = item.uniqueId || SnowflakeId()
		})

		// @ts-ignore
		val.forEach((item, index) => {
			if (item.type.includes(LabelText)) {
				const itemType = getItemType(val[index - 1]?.type)
				if (LabelTypes.includes(itemType as LabelTypeMap))
					item.value = `\u200B${item.value}`
				values.push(item)
				return
			}

			if (index === 0 && !item.type.includes(LabelText)) {
				values.push(getSpaceText())
				values.push(item)
				if (val.length === 1) values.push(getSpaceText())
				return
			}

			if (!val[index - 1].type.includes(LabelText)) values.push(getSpaceText())
			else {
				const lastOneCharacter = val[index - 1].value?.slice(-1)
				if (lastOneCharacter === "\n") values.push(getSpaceText())
			}
			values.push(item)

			if (index === val.length - 1 && !item.type.includes(LabelText))
				values.push(getSpaceText())
		})
		if (!values.length) values.push(getSpaceText())

		currentNodes.current = values
		setDisplayValue(values)
	})

	const filterNullValue = useMemoizedFn((resultValue = []) => {
		return (
			resultValue
				// @ts-ignore
				.map((item) => {
					// @ts-ignore
					if (item && item.type.includes(LabelText))
						// @ts-ignore
						item.value = item.value.replaceAll(/\u200B/g, "")
					return item
				})
				// @ts-ignore
				.filter((item) => item)
				.filter(
					// @ts-ignore
					(item) =>
						// @ts-ignore
						![LabelText].includes(getItemType(item.type) as LabelTypeMap) ||
						// @ts-ignore
						item.value,
				)
				// @ts-ignore
				.reduce((res, item) => {
					// @ts-ignore
					if (item && item.type.includes(LabelText)) res.push(item)
					// @ts-ignore
					else res.push(displayValue.find((v) => v.uniqueId === item.uniqueId))
					return res
				}, [])
		)
	})

	useUpdateEffect(() => {
		if (selectedNode) {
			openSelectPanel()
		}
	}, [selectedNode])

	const handleChange = useMemoizedFn((evt: any) => {
		// 特殊处理，当前模式是Textarea且输入的内容是/时，显示表达式菜单

		const { data } = evt.nativeEvent
		if (data === TextAreaModeTrigger) {
			const isPass = checkIsAllDollarWrapped(evt.target.innerText)
			if (isPass) {
				evt.stopPropagation()
				openSelectPanel()
			}
		}

		// // 检测用户输入 @ 时新增文本块
		// if (data === "@") {
		// 	evt.stopPropagation()

		// 	// 插入新的文本块
		// 	const newTextBlock = {
		// 		type: LabelText, // 假设LabelText是文本类型
		// 		uniqueId: SnowflakeId(),
		// 		value: "@", // 新文本块内容初始化为@
		// 	}

		// 	// 将新文本块插入到当前的 resultValue 中
		// 	currentNodes.current.push(newTextBlock)
		// 	changeRef.current.handleChange([...currentNodes.current])

		// 	// 由于插入了新块，需要重置光标
		// 	isResetCursor.current = true
		// 	setCurrentCursor()

		// 	// 阻止原文本更新
		// 	return
		// }

		// 中文输入法开始输入
		if (evt.type === "compositionstart") {
			isEntering.current = true
			changeRef.current.hiddenPlaceholder()
			return
		}

		// 中文输入法结束输入
		if (evt.type === "compositionend") {
			isEntering.current = false
		}

		// 中间输入拼音的时候如果还没结束输入那么后面就不用执行
		if (isEntering.current) return

		// 按键按下的状态不更新
		if (isKeyDown.current) {
			isExistNoUpdate.current = true
			return
		}
		const dom = editRef.current
		// 获取光标位置
		const selection = window.getSelection()
		const scrollTop =
			// @ts-ignore
			inputRef?.current?.getElementsByClassName("editable-container")[0]?.scrollTop || 0

		if (selection?.rangeCount && selection?.rangeCount > 0) {
			const cascaderRect = dom.getBoundingClientRect()
			const range = selection.getRangeAt(0).getBoundingClientRect()

			setPosition({
				left: (range.left - cascaderRect.left + 10) / computedZoom,
				top: (range.top - cascaderRect.top) / computedZoom + 20 - scrollTop,
			})
		}
		// @ts-ignore
		let { childNodes } = dom
		// @ts-ignore
		childNodes = Array.from(childNodes)
		// @ts-ignore
		let resultValue = childNodes.map((childNode) => {
			if (childNode.nodeName === "#text") {
				isResetCursor.current = true
				return {
					type: LabelText,
					uniqueId: SnowflakeId(),
					value: childNode.data,
				}
			}
			const currentType = getItemType(childNode?.dataset?.type) as LabelTypeMap
			if (!ALL_TYPE.includes(currentType)) {
				isResetCursor.current = true
				return ""
			}

			if ([LabelText].includes(currentType)) {
				if (childNode?.childNodes?.length > 1) {
					cursorRef.current = {
						...cursorRef.current,
						offset: -2,
					}
					isResetCursor.current = true
				}
				return {
					type: LabelText,
					uniqueId: childNode.dataset.id,
					value: childNode.innerText,
				}
			}
			return {
				type: currentType,
				uniqueId: childNode.dataset.id,
			}
		})

		currentNodes.current = cloneDeep(resultValue)

		resultValue = filterNullValue(resultValue)

		const lastNode = last(currentNodes.current)
		if (!lastNode || !lastNode.type.includes(LabelText)) isResetCursor.current = true

		changeRef.current.handleChange(resultValue)
		newValue.current = resultValue

		if (isResetCursor.current) {
			updateDisplayValue(resultValue)
		} else {
			setCurrentCursor()
		}
		isExistNoUpdate.current = false
		evt.stopPropagation()
	})

	const getCursor = useMemoizedFn(() => {
		const { id, type, offset } = cursorRef.current || {}
		if (!type || !type.includes(LabelText) || offset <= 0 || !id) return cursorRef.current
		const v = document.getElementById(id)?.innerText || ""
		if (!v.substr(0, offset).includes("\u200B")) return cursorRef.current
		return {
			id,
			type,
			offset: offset - 1,
		}
	})

	// 更具节点类型选择对应的组件
	const renderLabel = useMemoizedFn((type: LabelTypeMap) => {
		const labelMap = {
			[LabelTypeMap.LabelFunc]: LabelFunc,
			[LabelTypeMap.LabelNode]: LabelNode,
			[LabelTypeMap.LabelText]: LabelTextBlock,
			[LabelTypeMap.LabelMember]: LabelMember,
			[LabelTypeMap.LabelDateTime]: LabelDatetime,
			[LabelTypeMap.LabelSelect]: LabelSelect,
			[LabelTypeMap.LabelMultiple]: LabelMultiple,
			[LabelTypeMap.LabelCheckbox]: LabelCheckbox,
			[LabelTypeMap.LabelPassword]: LabelPassword,
			[LabelTypeMap.LabelDepartmentNames]: LabelDepartmentNames,
			[LabelTypeMap.LabelNames]: LabelNames,
		}
		const itemType = getItemType(type) as LabelTypeMap
		if (!labelMap[itemType]) return null
		return labelMap[itemType]
	})

	// 删除当前项
	const handleDelete = useMemoizedFn((val: EXPRESSION_ITEM) => {
		const resultData = cloneDeep(newValue.current)
		const index = resultData.findIndex((item) => item.uniqueId === val.uniqueId)
		if (index > -1) resultData.splice(index, 1)
		changeRef.current.handleChange(resultData)
		updateDisplayValue(resultData)
	})

	// 更新当前项
	const handleUpdate = useMemoizedFn((val: EXPRESSION_ITEM) => {
		const resultData = cloneDeep(newValue.current)
		const index = resultData.findIndex((item) => item.uniqueId === val.uniqueId)
		if (index > -1) resultData.splice(index, 1, val)
		changeRef.current.handleChange(resultData)
		updateDisplayValue(resultData)
	})

	const handleBackspace = useMemoizedFn((e: any) => {
		// 如果当前有选中节点，则删除这个节点
		if (selectedNode) {
			handleDelete({ uniqueId: selectedNode } as EXPRESSION_ITEM)
			return true
		}

		// @ts-ignore
		const dom = document.getSelection().getRangeAt(0)
		if (!dom.collapsed) return true // 有选择区域则不处理
		// @ts-ignore
		const { id } = dom?.endContainer?.parentNode?.dataset || {}
		if (!id) return true

		const index = currentNodes?.current?.findIndex((item) => item.uniqueId === id)
		if (index < 0) return true
		const node = currentNodes?.current[index]

		const offset = dom.endOffset
		const str = node?.value || ""

		// 如果删的不是第一个空白字符不处理，endOffset偏移没有包括换行符
		if (offset !== 1 || str[0] !== "\u200B") return true

		const secondNode = (currentNodes.current || [])[index - 1]
		const currentType = getItemType((secondNode || {}).type) as LabelTypeMap
		if (!secondNode || !LabelTypes.includes(currentType)) return true // 前面一个节点不是标签节点不处理

		if (isKeyDown.current) return true

		setCurrentCursor()
		cursorRef.current.offset = 0
		isResetCursor.current = true
		handleDelete(secondNode)
		return false
	})

	// 处理快捷键事件
	const handleKeyboardShortcuts = useMemoizedFn((e: React.KeyboardEvent) => {
		// 处理撤销重做快捷键 (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z)
		if (
			(e.ctrlKey || e.metaKey) &&
			(e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")
		) {
			// 不阻止事件传播，只返回false以阻止后续处理
			return false
		}

		// 处理保存快捷键 (Ctrl+S, Cmd+S)
		if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
			e.preventDefault()
			return false
		}

		return true
	})

	useEffect(() => {
		editRef.current.onkeydown = (e) => {
			// 先处理快捷键
			if (!handleKeyboardShortcuts(e)) {
				// 对于撤销重做快捷键，不阻止事件传播
				if (
					(e.ctrlKey || e.metaKey) &&
					(e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")
				) {
					return true // 允许事件继续传播
				}
				return false
			}

			if (e.keyCode === KeyCodeMap.BACKSPACE) {
				return handleBackspace(e)
			}
			if ([KeyCodeMap.ENTER].includes(e.keyCode)) {
				const { id, offset } = cursorRef.current
				const lastNode = last(currentNodes.current)
				const isEnd = lastNode?.uniqueId === id && lastNode?.value?.length === offset // 判断光标是否在整个末尾
				const endIsLineBreak = endsWith(lastNode?.value || "", "\n") // 判断倒数第一个字符是不是换行符
				const isAddMultiline = isEnd && !endIsLineBreak
				// if (isAddMultiline) {
				// 	cursorRef.current = {
				// 		...cursorRef.current,
				// 		offset: -2,
				// 	}
				// 	isResetCursor.current = true
				// }
				document.execCommand("insertHtml", true, isAddMultiline ? "\n\n" : "\n")
				return false
			}

			return true
		}
		editRef.current.onkeyup = (e) => {
			if ([KeyCodeMap.RIGHT, KeyCodeMap.LEFT].includes(e.keyCode)) setCurrentCursor()
		}
	})

	const onLabelValueChange = useMemoizedFn((uniqueId: string, labelValue: string) => {
		if (!uniqueId || !labelValue) return
		const index = displayValue.findIndex((item) => item.uniqueId === uniqueId)
		if (index > 0) {
			let copyValue = [...displayValue]
			// @ts-ignore
			copyValue.splice(index, 1, labelValue)
			// @ts-ignore
			copyValue = filterNullValue(copyValue)
			updateDisplayValue(copyValue)
			changeRef.current.handleChange(copyValue)
		}
	})

	const getDisplayValue = useMemoizedFn(() => {
		return displayValue
	})

	const getCurrentNode = useMemoizedFn(() => {
		return selectedNode
	})

	const setCurrentNode = useMemoizedFn((uniqueId: string) => {
		return setSelectedNode(uniqueId)
	})

	useEffect(() => {
		Object.assign(editChangeRef.current, {
			onLabelValueChange,
			getDataSource: changeRef?.current?.getDataSource,
			setCurrentNode,
			getCurrentNode,
		})
	}, [onLabelValueChange, changeRef, setCurrentNode, getCurrentNode])

	useImperativeHandle(
		// @ts-ignore
		ref,
		() => ({
			updateDisplayValue,
			getDisplayValue,
			getCursor,
			setCursor,
			setCurrentNode,
			getCurrentNode,
		}),
		[updateDisplayValue, getDisplayValue, getCursor, setCursor, setCurrentNode, getCurrentNode],
	)

	const [wrapperWidth, setWrapperWidth] = useState(0)

	useMount(() => {
		setWrapperWidth(editRef.current.clientWidth)
	})

	useSelectionChange(editRef)

	return (
		<Edit
			className={clsx("nodrag", extraClassname)}
			bordered={bordered}
			showMultipleLine={showMultipleLine}
			onInput={handleChange}
			onCompositionStart={handleChange}
			onCompositionEnd={handleChange}
			suppressContentEditableWarning
			mode={mode}
			minHeight={minHeight}
			// @ts-ignore
			ref={editRef}
			onClick={setCurrentCursor}
			key={editKey}
			contentEditable={!disabled}
			onKeyDown={(evt) => {
				evt.stopPropagation()
				isKeyDown.current = true
			}}
			onKeyUp={(e) => {
				// onkeyup 在 oninput之后执行
				e.stopPropagation()
				isKeyDown.current = false
				if (isExistNoUpdate.current) handleChange(e)
			}}
			onPaste={(e) => {
				e.nativeEvent.stopImmediatePropagation()
				e.stopPropagation()
				// 获取剪贴板中的纯文本内容
				let clipboardText = e.clipboardData.getData("text/plain")

				// 将 < 和 > 替换为 HTML 实体，防止作为 HTML 解析
				clipboardText = transferSpecialSign(clipboardText)
				document.execCommand("insertHtml", true, clipboardText)
				e.preventDefault()
			}}
			onBlur={(e) => {
				setTimeout(() => {
					if (!selectPanelOpen) {
						setSelectedNode("")
					}
				}, 500)
				banScroll()
			}}
		>
			{displayValue.map((item) => {
				const Component = renderLabel(item.type)
				// console.error(item);
				return (
					// @ts-ignore
					<Component
						key={item.uniqueId}
						config={item}
						// @ts-ignore
						editChangeRef={editChangeRef}
						selected={selectedNode === item.uniqueId}
						deleteFn={handleDelete}
						wrapperWidth={wrapperWidth}
						updateFn={handleUpdate}
					/>
				)
			})}
		</Edit>
	)
}
// @ts-ignore
export default memo(forwardRef(ContentEditable))
