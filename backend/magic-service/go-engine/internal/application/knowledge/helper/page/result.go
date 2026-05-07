// Package page 提供通用分页结果结构。
package page

// Result 表示通用分页结果。
type Result struct {
	Total int64 `json:"total"`
	List  any   `json:"list"`
}
