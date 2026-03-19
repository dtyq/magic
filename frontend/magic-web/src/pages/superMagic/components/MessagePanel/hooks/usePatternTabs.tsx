import { useEffect, useMemo, useState } from "react"
import { ModeItem, TopicMode } from "../../../pages/Workspace/types"
import { autorun } from "mobx"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

export const useModeList = ({
	includeChat = false,
	includeGeneral = true,
}: {
	includeChat?: boolean
	includeGeneral?: boolean
}) => {
	const [_modeList, setModeList] = useState<ModeItem[]>(superMagicModeService.modeList)

	useEffect(() => {
		return autorun(() => {
			setModeList(superMagicModeService.modeList)
		})
	}, [])

	const modeList = useMemo<ModeItem[]>(() => {
		let li = _modeList
		li = li.filter((item) => {
			if (item.mode.identifier === TopicMode.General) {
				return includeGeneral
			}
			if (item.mode.identifier === TopicMode.Chat) {
				return includeChat
			}
			return true
		})

		return li
	}, [_modeList, includeGeneral, includeChat])

	return {
		modeList,
	}
}
