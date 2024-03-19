import { createGlobalStyle } from "antd-style"

import { CLASSNAME_PREFIX } from "@/opensource/constants/style"

import animation from "./animation"
import antdOverride from "./antdOverride"
import "./viewTransition.css"

const prefixCls = CLASSNAME_PREFIX

export const GlobalStyle = createGlobalStyle(({ theme }) => [
	animation(),
	antdOverride({ prefixCls, token: theme }),
])
