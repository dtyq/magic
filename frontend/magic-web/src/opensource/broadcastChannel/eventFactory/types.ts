import { Login } from "@/opensource/types/login"

export interface PopupLoginData {
	token?: string
	state: string
	loginType: Login.LoginType
	registerToken?: string
	loginTicket?: string
}
