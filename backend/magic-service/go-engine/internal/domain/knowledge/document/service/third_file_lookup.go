package document

import (
	"context"

	docentity "magic/internal/domain/knowledge/document/entity"
)

// ThirdFileDocumentPlanInput 描述第三方文件文档映射解析输入。
type ThirdFileDocumentPlanInput struct {
	OrganizationCode  string
	ThirdPlatformType string
	ThirdFileID       string
}

// ThirdFileDocumentPlan 描述第三方文件重向量化使用的文档集合与 seed。
type ThirdFileDocumentPlan struct {
	Documents []*docentity.KnowledgeBaseDocument
	Seed      *ThirdFileRevectorizeSeed
}

// ThirdFilePlanner 定义第三方文件重向量化目标解析能力。
type ThirdFilePlanner interface {
	ResolveThirdFileDocumentPlan(ctx context.Context, input ThirdFileDocumentPlanInput) (ThirdFileDocumentPlan, error)
}
