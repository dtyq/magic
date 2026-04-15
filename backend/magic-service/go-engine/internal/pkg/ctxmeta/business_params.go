// Package ctxmeta 提供业务参数的类型化辅助。
// 该包包含跨层传递的业务参数工具。
package ctxmeta

import (
	"errors"

	"magic/internal/constants"
)

// BusinessParams 校验错误
var (
	ErrOrganizationCodeRequired = errors.New("organization_code is required")
	// ErrOrganizationIDRequired 兼容旧错误常量名。
	ErrOrganizationIDRequired = ErrOrganizationCodeRequired
	ErrUserIDRequired         = errors.New("user_id is required")
	ErrBusinessIDRequired     = errors.New("business_id is required")
)

// BusinessParams 携带跨服务请求的业务上下文元数据。
// 包含计费与数据隔离所需的业务标识。
type BusinessParams struct {
	OrganizationCode string `json:"organization_code"` // 组织编码
	// OrganizationID 兼容旧字段，优先级低于 OrganizationCode。
	OrganizationID string `json:"organization_id,omitempty"`
	UserID         string `json:"user_id"`     // 用户标识
	BusinessID     string `json:"business_id"` // 业务/事务标识
}

// ToMap 使用常量键将 BusinessParams 转为 map
// 可用于构建请求负载或过滤条件
func (bp BusinessParams) ToMap() map[string]string {
	orgCode := bp.GetOrganizationCode()
	return map[string]string{
		constants.OrgIDField:       orgCode,
		constants.LegacyOrgIDField: orgCode,
		constants.UserIDField:      bp.UserID,
		constants.BusinessIDField:  bp.BusinessID,
	}
}

// IsEmpty 判断是否所有字段为空
func (bp BusinessParams) IsEmpty() bool {
	return bp.GetOrganizationCode() == "" && bp.UserID == "" && bp.BusinessID == ""
}

// GetOrganizationCode 返回标准化组织编码。
func (bp BusinessParams) GetOrganizationCode() string {
	if bp.OrganizationCode != "" {
		return bp.OrganizationCode
	}
	return bp.OrganizationID
}

// Validate 校验 BusinessParams，不合法则返回错误
// 为保证租户隔离，至少需要提供组织编码
func (bp BusinessParams) Validate() error {
	if bp.GetOrganizationCode() == "" {
		return ErrOrganizationCodeRequired
	}
	// 某些操作允许 UserID 与 BusinessID 为空
	return nil
}

// ValidateStrict 严格校验，要求全部字段存在
func (bp BusinessParams) ValidateStrict() error {
	if bp.GetOrganizationCode() == "" {
		return ErrOrganizationCodeRequired
	}
	if bp.UserID == "" {
		return ErrUserIDRequired
	}
	if bp.BusinessID == "" {
		return ErrBusinessIDRequired
	}
	return nil
}
