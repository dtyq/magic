package knowledgebase

import (
	"context"
	"fmt"
	"slices"
	"strings"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
)

// BindingReader 定义产品线判定依赖的知识库绑定读取能力。
type BindingReader interface {
	ListBindIDsByKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
		bindType kbentity.BindingType,
	) ([]string, error)
	ListBindIDsByKnowledgeBases(
		ctx context.Context,
		knowledgeBaseCodes []string,
		bindType kbentity.BindingType,
	) (map[string][]string, error)
}

// ProductLineSnapshot 表示知识库绑定关系与推导后的产品线快照。
type ProductLineSnapshot struct {
	AgentCodesByKnowledgeBase map[string][]string
	KnowledgeBaseTypes        map[string]kbentity.Type
}

// ProductLineResolver 只负责读取知识库与数字员工的绑定快照。
//
// 产品线必须以 magic_flow_knowledge.knowledge_base_type 为准；
// super_magic_agent binding 同时承载“自建数字员工知识库”和“关联 flow 向量知识库”两种关系，
// 不能再作为存量知识库产品线判定依据。
type ProductLineResolver struct {
	bindingReader BindingReader
}

// NewProductLineResolver 创建知识库产品线解析器。
func NewProductLineResolver(bindingReader BindingReader) ProductLineResolver {
	return ProductLineResolver{bindingReader: bindingReader}
}

// ResolveKnowledgeBaseTypeByAgentCodes 按创建请求里的 agent_codes 解析知识库产品线。
//
// 这是创建入口唯一允许使用的产品线判定口径：
// 1. agent_codes 非空 => digital_employee
// 2. agent_codes 为空 => flow_vector
//
// source_type 和 source binding 只能在产品线确定后再解释，不能反向参与产品线判定。
func ResolveKnowledgeBaseTypeByAgentCodes(agentCodes []string) kbentity.Type {
	for _, agentCode := range agentCodes {
		if strings.TrimSpace(agentCode) != "" {
			return kbentity.KnowledgeBaseTypeDigitalEmployee
		}
	}
	return kbentity.KnowledgeBaseTypeFlowVector
}

// ResolveKnowledgeBaseType 是历史兼容入口，不能通过 binding 推导数字员工产品线。
func (r ProductLineResolver) ResolveKnowledgeBaseType(
	ctx context.Context,
	knowledgeBaseCode string,
) (kbentity.Type, error) {
	snapshot, err := r.ResolveSnapshot(ctx, []string{knowledgeBaseCode})
	if err != nil {
		return "", err
	}
	return snapshot.KnowledgeBaseTypes[strings.TrimSpace(knowledgeBaseCode)], nil
}

// ResolveSnapshot 批量读取存量知识库绑定。
//
// KnowledgeBaseTypes 字段只保留历史兼容默认值；真实产品线由知识库行上的
// knowledge_base_type 决定。
func (r ProductLineResolver) ResolveSnapshot(
	ctx context.Context,
	knowledgeBaseCodes []string,
) (*ProductLineSnapshot, error) {
	normalizedCodes := normalizeKnowledgeBaseCodes(knowledgeBaseCodes)
	snapshot := &ProductLineSnapshot{
		AgentCodesByKnowledgeBase: make(map[string][]string, len(normalizedCodes)),
		KnowledgeBaseTypes:        make(map[string]kbentity.Type, len(normalizedCodes)),
	}
	for _, code := range normalizedCodes {
		snapshot.AgentCodesByKnowledgeBase[code] = []string{}
		snapshot.KnowledgeBaseTypes[code] = kbentity.KnowledgeBaseTypeFlowVector
	}
	if len(normalizedCodes) == 0 || r.bindingReader == nil {
		return snapshot, nil
	}

	agentCodesByKnowledgeBase, err := r.bindingReader.ListBindIDsByKnowledgeBases(
		ctx,
		normalizedCodes,
		kbentity.BindingTypeSuperMagicAgent,
	)
	if err != nil {
		return nil, fmt.Errorf("list knowledge base super magic agent bindings: %w", err)
	}

	for _, code := range normalizedCodes {
		agentCodes := normalizeProductLineAgentCodes(agentCodesByKnowledgeBase[code])
		snapshot.AgentCodesByKnowledgeBase[code] = agentCodes
	}
	return snapshot, nil
}

func normalizeKnowledgeBaseCodes(knowledgeBaseCodes []string) []string {
	normalized := make([]string, 0, len(knowledgeBaseCodes))
	seen := make(map[string]struct{}, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	slices.Sort(normalized)
	return normalized
}

func normalizeProductLineAgentCodes(agentCodes []string) []string {
	normalized := make([]string, 0, len(agentCodes))
	seen := make(map[string]struct{}, len(agentCodes))
	for _, agentCode := range agentCodes {
		trimmed := strings.TrimSpace(agentCode)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	slices.Sort(normalized)
	return normalized
}
