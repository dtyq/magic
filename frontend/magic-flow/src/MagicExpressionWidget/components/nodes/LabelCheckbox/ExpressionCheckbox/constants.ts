import i18next from "i18next"
import _ from "lodash"


export const checkboxSelectOptions = [
	{
		label: i18next.t("common.real", { ns: "magicFlow" }),
		value: true
	},
	{
		label: i18next.t("common.artifact", { ns: "magicFlow" }),
		value: false
	},
]


/** 获取具体的项 */
export const getTargetCheckboxOption = (bool: boolean ) => {
	return _.cloneDeep(checkboxSelectOptions.find(o => o.value === bool))
}