import { FILE_ITEM_HEIGHT, FILE_ITEM_GAP } from "./styles"

export const getListHeight = (count: number) => {
	return count * FILE_ITEM_HEIGHT + FILE_ITEM_GAP * (count - 1)
}
