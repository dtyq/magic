// Package sharedaccess 提供知识库应用层共享的关系权限读取能力。
package sharedaccess

import (
	"context"
	"fmt"
	"strings"

	kbaccess "magic/internal/domain/knowledge/access/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
)

// KnowledgeBaseReader 读取知识库产品线信息。
type KnowledgeBaseReader interface {
	List(ctx context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error)
}

// KnowledgeBaseBindingReader 批量读取知识库与数字员工的关系。
type KnowledgeBaseBindingReader interface {
	ListBindIDsByKnowledgeBases(
		ctx context.Context,
		knowledgeBaseCodes []string,
		bindType kbentity.BindingType,
	) (map[string][]string, error)
}

// SuperMagicAgentAccessReader 批量读取当前用户可见/可管理的数字员工。
type SuperMagicAgentAccessReader interface {
	ListAccessibleCodes(ctx context.Context, organizationCode, userID string, codes []string) (map[string]struct{}, error)
	ListManageableCodes(ctx context.Context, organizationCode, userID string, codes []string) (map[string]struct{}, error)
}

// NewDigitalEmployeeRelationshipReader 创建数字员工知识库关系权限 reader。
//
// 只有 digital_employee 知识库继承绑定数字员工的权限；flow_vector 等其他
// 产品线返回空结果，由统一访问服务继续使用其自身权限源判定。
func NewDigitalEmployeeRelationshipReader(
	knowledgeBaseReader KnowledgeBaseReader,
	bindingReader KnowledgeBaseBindingReader,
	agentAccessReader SuperMagicAgentAccessReader,
) kbaccess.ExternalAccessReader {
	if knowledgeBaseReader == nil || bindingReader == nil || agentAccessReader == nil {
		return nil
	}
	return &digitalEmployeeRelationshipReader{
		knowledgeBaseReader: knowledgeBaseReader,
		bindingReader:       bindingReader,
		agentAccessReader:   agentAccessReader,
	}
}

type digitalEmployeeRelationshipReader struct {
	knowledgeBaseReader KnowledgeBaseReader
	bindingReader       KnowledgeBaseBindingReader
	agentAccessReader   SuperMagicAgentAccessReader
}

func (r *digitalEmployeeRelationshipReader) ListOperations(
	ctx context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCodes []string,
) (map[string]kbaccess.Operation, error) {
	if r == nil || len(knowledgeBaseCodes) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}
	codes := normalizeCodes(knowledgeBaseCodes)
	if len(codes) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	knowledgeBases, _, err := r.knowledgeBaseReader.List(ctx, &kbrepository.Query{
		OrganizationCode: actor.OrganizationCode,
		Codes:            codes,
		Offset:           0,
		Limit:            len(codes),
	})
	if err != nil {
		return nil, fmt.Errorf("list knowledge bases for relationship access: %w", err)
	}
	digitalCodes := make([]string, 0, len(knowledgeBases))
	for _, knowledgeBase := range knowledgeBases {
		if knowledgeBase == nil || knowledgeBase.KnowledgeBaseType != kbentity.KnowledgeBaseTypeDigitalEmployee {
			continue
		}
		code := strings.TrimSpace(knowledgeBase.Code)
		if code != "" {
			digitalCodes = append(digitalCodes, code)
		}
	}
	if len(digitalCodes) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	bindingsByKnowledgeBase, err := r.bindingReader.ListBindIDsByKnowledgeBases(
		ctx,
		digitalCodes,
		kbentity.BindingTypeSuperMagicAgent,
	)
	if err != nil {
		return nil, fmt.Errorf("list digital employee knowledge base bindings: %w", err)
	}

	agentCodes := uniqueBindingIDs(bindingsByKnowledgeBase, digitalCodes)
	if len(agentCodes) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}
	accessible, err := r.agentAccessReader.ListAccessibleCodes(ctx, actor.OrganizationCode, actor.UserID, agentCodes)
	if err != nil {
		return nil, fmt.Errorf("list accessible digital employees: %w", err)
	}
	manageable, err := r.agentAccessReader.ListManageableCodes(ctx, actor.OrganizationCode, actor.UserID, agentCodes)
	if err != nil {
		return nil, fmt.Errorf("list manageable digital employees: %w", err)
	}

	operations := make(map[string]kbaccess.Operation)
	for _, code := range digitalCodes {
		bindings := normalizeCodes(bindingsByKnowledgeBase[code])
		if len(bindings) == 0 {
			continue
		}
		readable := false
		allManageable := true
		for _, agentCode := range bindings {
			if _, ok := accessible[agentCode]; ok {
				readable = true
			}
			if _, ok := manageable[agentCode]; !ok {
				allManageable = false
			}
		}
		if !readable {
			continue
		}
		if allManageable {
			operations[code] = kbaccess.OperationEdit
			continue
		}
		operations[code] = kbaccess.OperationRead
	}
	return operations, nil
}

func uniqueBindingIDs(bindingsByKnowledgeBase map[string][]string, codes []string) []string {
	result := make([]string, 0)
	seen := make(map[string]struct{})
	for _, code := range codes {
		for _, agentCode := range normalizeCodes(bindingsByKnowledgeBase[code]) {
			if _, ok := seen[agentCode]; ok {
				continue
			}
			seen[agentCode] = struct{}{}
			result = append(result, agentCode)
		}
	}
	return result
}

func normalizeCodes(codes []string) []string {
	result := make([]string, 0, len(codes))
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		code = strings.TrimSpace(code)
		if code == "" {
			continue
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		result = append(result, code)
	}
	return result
}
