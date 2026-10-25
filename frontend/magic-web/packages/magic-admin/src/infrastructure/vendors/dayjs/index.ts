import dayjs from "dayjs"
import "dayjs/locale/zh-cn"

// Keep admin date handling behind its infrastructure boundary so standalone
// package builds and the host application share the same import contract.
export default dayjs
export type { Dayjs } from "dayjs"
