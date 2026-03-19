export function preloadUserMenus() {
	return import("../../UserMenus").then((module) => {
		module.default
	})
}
