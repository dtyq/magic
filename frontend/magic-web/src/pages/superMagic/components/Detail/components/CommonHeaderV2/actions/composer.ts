import { DetailType } from "../../../types"
import { DEFAULT_ACTION_KEYS_BY_TYPE } from "./config"
import { BUILTIN_ACTION_REGISTRY } from "./registry"
import type {
	ActionContext,
	ActionKey,
	ComposedAction,
	CustomActionSpec,
	HeaderActionConfig,
} from "../types"
import {
	canShowDownload,
	canShowMore,
	canShowRefresh,
	canShowShare,
	showBasicActions,
	supportsCopy,
	supportsViewModeToggle,
} from "../utils/guards"

function resolveBoolean(
	value: boolean | ((context: ActionContext) => boolean) | undefined,
	context: ActionContext,
	defaultValue = true,
): boolean {
	if (typeof value === "function") return value(context)
	if (typeof value === "boolean") return value
	return defaultValue
}

function shouldShowBuiltinAction(key: ActionKey, context: ActionContext): boolean {
	switch (key) {
		case "viewMode":
			return supportsViewModeToggle(context.type, context.isEditMode)
		case "refresh":
			return showBasicActions(context.type) && !context.isEditMode && canShowRefresh(context)
		case "download":
			return showBasicActions(context.type) && !context.isEditMode && canShowDownload(context)
		case "copy":
			return (
				showBasicActions(context.type) &&
				!context.isEditMode &&
				supportsCopy(context.type, context.viewMode, context.isFromNode)
			)
		case "share":
			return showBasicActions(context.type) && !context.isEditMode && canShowShare(context)
		case "openUrl":
			return context.type === DetailType.Browser && !context.isEditMode
		case "fullscreen":
			return !context.isMobile
		case "versionMenu":
		case "more":
			return canShowMore(context)
		default:
			return true
	}
}

function sortActions(actions: ComposedAction[]) {
	return actions.sort((a, b) => a.order - b.order)
}

function insertCustomAction(
	actions: ComposedAction[],
	action: ComposedAction,
	customSpec: CustomActionSpec,
) {
	if (customSpec.before) {
		// 查找目标按钮（可以是 builtin 或 custom）
		const index = actions.findIndex((item) => item.key === customSpec.before)
		if (index >= 0) {
			actions.splice(index, 0, action)
			return
		}
	}

	if (customSpec.after) {
		// 查找目标按钮（可以是 builtin 或 custom）
		const index = actions.findIndex((item) => item.key === customSpec.after)
		if (index >= 0) {
			actions.splice(index + 1, 0, action)
			return
		}
	}

	actions.push(action)
}

export function composeHeaderActions(
	context: ActionContext,
	actionConfig?: HeaderActionConfig,
): ComposedAction[] {
	const typeKey = context.type || "default"
	const template = DEFAULT_ACTION_KEYS_BY_TYPE[typeKey] || DEFAULT_ACTION_KEYS_BY_TYPE.default
	const hiddenDefaults = new Set(actionConfig?.hideDefaults || [])
	const orderMapping = new Map<ActionKey, number>()

	;(actionConfig?.order || []).forEach((key, index) => {
		orderMapping.set(key, index + 1)
	})

	const builtinActions: ComposedAction[] = template
		.filter((key) => !hiddenDefaults.has(key))
		.map((key) => {
			const base = BUILTIN_ACTION_REGISTRY[key]
			const override = actionConfig?.overrides?.[key]
			const isVisible = resolveBoolean(
				override?.visible,
				context,
				shouldShowBuiltinAction(key, context),
			)
			if (!isVisible) return null

			return {
				kind: "builtin" as const,
				key,
				zone: base.zone,
				order: override?.order ?? orderMapping.get(key) ?? base.order,
				disabled: resolveBoolean(override?.disabled, context, false),
				text: override?.text,
				tooltip: override?.tooltip,
				onClick: override?.onClick,
				iconStyle: override?.iconStyle,
				showText: override?.showText,
			}
		})
		.filter(Boolean) as ComposedAction[]

	const customActions: ComposedAction[] = []
	const customActionsWithRelativePosition: Array<{
		action: ComposedAction
		spec: CustomActionSpec
	}> = []

	;(actionConfig?.customActions || []).forEach((item, index) => {
		if (!resolveBoolean(item.visible, context, true)) return

		const customAction: ComposedAction = {
			kind: "custom",
			key: item.key,
			zone: item.zone || "primary",
			order: orderMapping.get(item.key as ActionKey) ?? 1000 + index,
			render: item.render,
		}

		// 如果 customAction 有 before/after，需要特殊处理（相对定位）
		if (item.before || item.after) {
			customActionsWithRelativePosition.push({
				action: customAction,
				spec: item,
			})
		} else {
			// 没有相对定位的，使用 order 排序
			customActions.push(customAction)
		}
	})

	const groupedByZone = new Map<string, ComposedAction[]>()
	;["leading", "primary", "secondary", "overflow", "trailing"].forEach((zone) => {
		groupedByZone.set(zone, [])
	})

	// 先对 builtinActions 和没有相对定位的 customActions 排序并分组
	const actionsWithoutRelative = [...builtinActions, ...customActions]
	sortActions(actionsWithoutRelative).forEach((action) => {
		const zoneActions = groupedByZone.get(action.zone)
		if (zoneActions) {
			zoneActions.push(action)
		}
	})

	// 然后处理有相对定位的 customActions，使用 insertCustomAction 插入
	customActionsWithRelativePosition.forEach(({ action, spec }) => {
		const zoneActions = groupedByZone.get(action.zone)
		if (!zoneActions) return
		insertCustomAction(zoneActions, action, spec)
	})

	return ["leading", "primary", "secondary", "overflow", "trailing"].flatMap(
		(zone) => groupedByZone.get(zone) || [],
	)
}
