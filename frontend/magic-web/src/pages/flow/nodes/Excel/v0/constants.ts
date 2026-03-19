import i18next from "i18next"

export enum LoaderType {
	File = "file",
}

export const loaderOptions = [
	{
		label: i18next.t("common.file", { ns: "flow" }),
		value: LoaderType.File,
	},
]
