package sharedroute

// CloneResolvedRoute 复制运行时路由，避免不同链路共用一份 route 数据。
//
// 这里的业务原因很直接：route 会跟着快照一起往下传，后面如果有人补字段、做 normalize，
// 不能回头把上游快照里的 route 一起改脏。
//
// ResolvedRoute 现在是扁平运行时结果，没有复杂嵌套，结构体复制就够。
// 这里的 clone 只是为了防止业务链路串数据，不是在提供通用 deep copy 能力。
func CloneResolvedRoute(route *ResolvedRoute) *ResolvedRoute {
	if route == nil {
		return nil
	}
	cloned := *route
	return &cloned
}
