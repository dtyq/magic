const PLATEFORM_PREFIX = "MAGIC_FLOW"

const VERSION = "V1_0_1"

export const platformKey = (str: string) => `${PLATEFORM_PREFIX}:${VERSION}:${str}`
