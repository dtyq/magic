import _ from "lodash";
import { TimeSelectType } from "./type";
import i18next from "i18next";


export const timeSelectOptions = [
	{
		id: TimeSelectType.Today,
		label: i18next.t("common.today", { ns: "magicFlow" }),
		value: {
			type: TimeSelectType.Today,
			value: ""
		}
	},
	{
		id: TimeSelectType.Tomorrow,
		label: i18next.t("common.tomorrow", { ns: "magicFlow" }),
		value: {
			type: TimeSelectType.Tomorrow,
			value: ""
		}
	},
	{
		id: TimeSelectType.Yesterday,
		label: i18next.t("common.yesterday", { ns: "magicFlow" }),
		value: {
			type: TimeSelectType.Yesterday,
			value: ""
		}
	},
	{
		id: TimeSelectType.TriggerTime,
		label: i18next.t("common.triggerTime", { ns: "magicFlow" }),
		value: {
			type: TimeSelectType.TriggerTime,
			value: ""
		}
	}
]

/** 获取具体的项 */
export const getTargetDateTimeOption = (type:TimeSelectType ) => {
	return _.cloneDeep(timeSelectOptions.find(o => o.id === type))
}