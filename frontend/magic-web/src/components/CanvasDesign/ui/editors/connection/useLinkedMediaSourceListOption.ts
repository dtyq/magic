import { useCallback, useMemo } from "react"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { SourceListOption } from "../../panels/source-list/index"
import {
	resolveLinkedMediaSelectionDisplay,
	type LinkedEditorMediaInactiveReason,
	type LinkedEditorMediaItem,
} from "./linkedEditorInputs"

interface LinkedMediaSourceListOptionInput {
	item: LinkedEditorMediaItem & { path: string }
	index: number
	slotIndex: number
	label: string
	onLinkedMediaSelectionChange?: (connectionId: string, selected: boolean) => void
}

/** 将关联媒体业务状态统一转换为 SourceList 的纯展示/选择配置。 */
export function useLinkedMediaSourceListOption() {
	const { t } = useCanvasDesignI18n()
	const selectionLabel = t("connectionEditor.includeLinkedMedia", "参与参考媒体")
	const inactiveReasonLabels = useMemo<Record<LinkedEditorMediaInactiveReason, string>>(
		() => ({
			"unsupported-type": t("connectionEditor.linkedMediaUnsupportedType", "类型不支持"),
			"unsupported-mode": t("connectionEditor.linkedMediaUnsupportedMode", "当前模式不支持"),
			"over-limit": t("connectionEditor.linkedMediaOverLimit", "数量超限"),
			"missing-resource": t("connectionEditor.linkedMediaMissingResource", "资源缺失"),
			duplicate: t("connectionEditor.linkedMediaDuplicate", "已添加"),
		}),
		[t],
	)

	return useCallback(
		(options: LinkedMediaSourceListOptionInput): SourceListOption => {
			const { item, index, slotIndex, label, onLinkedMediaSelectionChange } = options
			const selectionDisplay = resolveLinkedMediaSelectionDisplay(item)
			const selectionDisabledLabel = item.selectionDisabledReason
				? inactiveReasonLabels[item.selectionDisabledReason]
				: undefined

			return {
				kind: "slot",
				label,
				value: `linked-reference-${item.connectionId}-${index}`,
				slotIndex,
				groupId: item.kind,
				resourcePath: item.path,
				resourceFileName: item.fileName,
				resourceMediaType: item.kind,
				sourceCrop: item.sourceCrop,
				readOnly: true,
				isLinked: true,
				selection: {
					checked: selectionDisplay.checked,
					disabled: selectionDisplay.disabled,
					ariaLabel: `${selectionLabel}：${item.fileName || item.path}`,
					title: selectionDisplay.disabled
						? (selectionDisabledLabel ?? selectionLabel)
						: selectionLabel,
					onCheckedChange: (selected) =>
						onLinkedMediaSelectionChange?.(item.connectionId, selected),
				},
			}
		},
		[inactiveReasonLabels, selectionLabel],
	)
}
