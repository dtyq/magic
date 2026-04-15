package knowledgebase

import (
	"context"
	"fmt"
	"slices"
	"strings"
)

// BindingReader 定义产品线判定依赖的知识库绑定读取能力。
type BindingReader interface {
	ListBindIDsByKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
		bindType BindingType,
	) ([]string, error)
	ListBindIDsByKnowledgeBases(
		ctx context.Context,
		knowledgeBaseCodes []string,
		bindType BindingType,
	) (map[string][]string, error)
}

// ProductLineSnapshot 表示知识库绑定关系与推导后的产品线快照。
type ProductLineSnapshot struct {
	AgentCodesByKnowledgeBase map[string][]string
	KnowledgeBaseTypes        map[string]Type
}

// ProductLineResolver 负责基于 knowledge_base_bindings 统一解析知识库产品线。
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
func ResolveKnowledgeBaseTypeByAgentCodes(agentCodes []string) Type {
	for _, agentCode := range agentCodes {
		if strings.TrimSpace(agentCode) != "" {
			return KnowledgeBaseTypeDigitalEmployee
		}
	}
	return KnowledgeBaseTypeFlowVector
}

// ResolveKnowledgeBaseType 按知识库编码解析产品线。
func (r ProductLineResolver) ResolveKnowledgeBaseType(
	ctx context.Context,
	knowledgeBaseCode string,
) (Type, error) {
	snapshot, err := r.ResolveSnapshot(ctx, []string{knowledgeBaseCode})
	if err != nil {
		return "", err
	}
	return snapshot.KnowledgeBaseTypes[strings.TrimSpace(knowledgeBaseCode)], nil
}

// ResolveSnapshot 批量读取存量知识库绑定并推导产品线。
//
// 这个入口只服务更新、读取和下游消费场景，依据的是已经落库的绑定快照；
// 若未查到数字员工绑定，则按历史兼容默认视为 flow_vector。
func (r ProductLineResolver) ResolveSnapshot(
	ctx context.Context,
	knowledgeBaseCodes []string,
) (*ProductLineSnapshot, error) {
	normalizedCodes := normalizeKnowledgeBaseCodes(knowledgeBaseCodes)
	snapshot := &ProductLineSnapshot{
		AgentCodesByKnowledgeBase: make(map[string][]string, len(normalizedCodes)),
		KnowledgeBaseTypes:        make(map[string]Type, len(normalizedCodes)),
	}
	for _, code := range normalizedCodes {
		snapshot.AgentCodesByKnowledgeBase[code] = []string{}
		snapshot.KnowledgeBaseTypes[code] = KnowledgeBaseTypeFlowVector
	}
	if len(normalizedCodes) == 0 || r.bindingReader == nil {
		return snapshot, nil
	}

	agentCodesByKnowledgeBase, err := r.bindingReader.ListBindIDsByKnowledgeBases(
		ctx,
		normalizedCodes,
		BindingTypeSuperMagicAgent,
	)
	if err != nil {
		return nil, fmt.Errorf("list knowledge base super magic agent bindings: %w", err)
	}

	for _, code := range normalizedCodes {
		agentCodes := normalizeProductLineAgentCodes(agentCodesByKnowledgeBase[code])
		snapshot.AgentCodesByKnowledgeBase[code] = agentCodes
		snapshot.KnowledgeBaseTypes[code] = ResolveKnowledgeBaseTypeByAgentCodes(agentCodes)
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
