import { nanoid } from "nanoid"

export const genRequestId = (len: number = 8) => nanoid(len)

const appMessageIdPrefix = "WEB-"

export const genAppMessageId = () => appMessageIdPrefix + nanoid()

export const isAppMessageId = (id: string) => id.startsWith(appMessageIdPrefix)
