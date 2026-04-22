package dto

import (
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
)

// TeamshareStartVectorRequest 表示 Teamshare start-vector RPC 请求。
type TeamshareStartVectorRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	KnowledgeID   string        `json:"knowledge_id" validate:"required"`
}

// Validate 校验 TeamshareStartVectorRequest。
func (r TeamshareStartVectorRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	if err := validateRequiredUserID(r.DataIsolation.UserID); err != nil {
		return err
	}
	return validateTrimmedRequiredString("knowledge_id", r.KnowledgeID)
}

// TeamshareManageableRequest 表示 Teamshare manageable RPC 请求。
type TeamshareManageableRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
}

// Validate 校验 TeamshareManageableRequest。
func (r TeamshareManageableRequest) Validate() error {
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// TeamshareManageableProgressRequest 表示 Teamshare manageable-progress RPC 请求。
type TeamshareManageableProgressRequest struct {
	DataIsolation  DataIsolation `json:"data_isolation"`
	KnowledgeCodes []string      `json:"knowledge_codes"`
}

// Validate 校验 TeamshareManageableProgressRequest。
func (r TeamshareManageableProgressRequest) Validate() error {
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// TeamshareStartVectorResponse 表示 Teamshare start-vector RPC 响应。
type TeamshareStartVectorResponse struct {
	ID string `json:"id"`
}

// TeamshareKnowledgeProgressResponse 表示 Teamshare 兼容进度项响应。
type TeamshareKnowledgeProgressResponse struct {
	KnowledgeCode string `json:"knowledge_code"`
	KnowledgeType int    `json:"knowledge_type"`
	BusinessID    string `json:"business_id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	VectorStatus  int    `json:"vector_status"`
	ExpectedNum   int    `json:"expected_num"`
	CompletedNum  int    `json:"completed_num"`
}

// TeamshareKnowledgeListResponse 表示 Teamshare 列表型 RPC 响应。
type TeamshareKnowledgeListResponse struct {
	List []*TeamshareKnowledgeProgressResponse `json:"list"`
}

// NewTeamshareKnowledgeListResponse 构造 Teamshare 列表型响应。
func NewTeamshareKnowledgeListResponse(items []*kbdto.TeamshareKnowledgeProgressDTO) *TeamshareKnowledgeListResponse {
	if len(items) == 0 {
		return &TeamshareKnowledgeListResponse{List: []*TeamshareKnowledgeProgressResponse{}}
	}

	list := make([]*TeamshareKnowledgeProgressResponse, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		list = append(list, &TeamshareKnowledgeProgressResponse{
			KnowledgeCode: strings.TrimSpace(item.KnowledgeCode),
			KnowledgeType: item.KnowledgeType,
			BusinessID:    strings.TrimSpace(item.BusinessID),
			Name:          item.Name,
			Description:   item.Description,
			VectorStatus:  item.VectorStatus,
			ExpectedNum:   item.ExpectedNum,
			CompletedNum:  item.CompletedNum,
		})
	}
	return &TeamshareKnowledgeListResponse{List: list}
}
