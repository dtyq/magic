// Package access 提供知识库统一访问判定服务。
package access

import (
	"context"
	"fmt"
	"slices"
	"strings"
)

// Actor 表示发起知识库访问判定的主体。
type Actor struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
}

// Target 表示待判定的知识库资源。
type Target struct {
	KnowledgeBaseCode string
}

// InitializeInput 表示知识库权限初始化输入。
type InitializeInput struct {
	KnowledgeBaseCode string
	OwnerUserID       string
	KnowledgeType     int
	BusinessID        string
	AdminUserIDs      []string
}

// RebuildItem 表示权限补齐时的单个知识库输入。
type RebuildItem struct {
	OrganizationCode  string
	CurrentUserID     string
	KnowledgeBaseCode string
	OwnerUserID       string
	KnowledgeType     int
	BusinessID        string
	AdminUserIDs      []string
}

// Operation 表示知识库操作权限。
type Operation string

const (
	// OperationNone 表示无权限。
	OperationNone Operation = "none"
	// OperationOwner 表示所有者权限。
	OperationOwner Operation = "owner"
	// OperationAdmin 表示管理员权限。
	OperationAdmin Operation = "admin"
	// OperationRead 表示只读权限。
	OperationRead Operation = "read"
	// OperationEdit 表示编辑权限。
	OperationEdit Operation = "edit"
)

const (
	// UserOperationNone 表示接口层无权限值。
	UserOperationNone = 0
	// UserOperationOwner 表示接口层 owner 权限值。
	UserOperationOwner = 1
	// UserOperationAdmin 表示接口层 admin 权限值。
	UserOperationAdmin = 2
	// UserOperationRead 表示接口层 read 权限值。
	UserOperationRead = 3
	// UserOperationEdit 表示接口层 edit 权限值。
	UserOperationEdit = 4
)

const (
	operationStrengthOwner = iota
	operationStrengthAdmin
	operationStrengthEdit
	operationStrengthRead
	operationStrengthNone
)

// PermissionReader 表示本地权限源。
type PermissionReader interface {
	ListOperations(
		ctx context.Context,
		organizationCode string,
		userID string,
		knowledgeBaseCodes []string,
	) (map[string]string, error)
}

// ExternalAccessReader 表示外部知识库权限源。
type ExternalAccessReader interface {
	ListOperations(ctx context.Context, actor Actor, knowledgeBaseCodes []string) (map[string]Operation, error)
}

// RelationReader 为后续文档/片段资源一致性校验预留。
type RelationReader interface {
	NormalizeTarget(ctx context.Context, actor Actor, target Target) (Target, error)
}

// LocalPermissionWriter 表示本地知识库权限写入能力。
type LocalPermissionWriter interface {
	Initialize(ctx context.Context, actor Actor, input InitializeInput) error
	GrantOwner(
		ctx context.Context,
		actor Actor,
		knowledgeBaseCode string,
		ownerUserID string,
	) error
	Cleanup(
		ctx context.Context,
		actor Actor,
		knowledgeBaseCode string,
	) error
}

// Result 表示单资源访问判定结果。
type Result struct {
	Operation Operation
	Target    Target
}

// Service 统一知识库访问判定。
type Service struct {
	permissionReader PermissionReader
	permissionWriter LocalPermissionWriter
	externalReader   ExternalAccessReader
	relationReader   RelationReader
}

// NewService 创建统一访问判定服务。
func NewService(
	permissionReader PermissionReader,
	permissionWriter LocalPermissionWriter,
	externalReader ExternalAccessReader,
	relationReader RelationReader,
) *Service {
	return &Service{
		permissionReader: permissionReader,
		permissionWriter: permissionWriter,
		externalReader:   externalReader,
		relationReader:   relationReader,
	}
}

// Authorize 判定单个知识库资源是否可执行指定动作。
func (s *Service) Authorize(
	ctx context.Context,
	actor Actor,
	action string,
	target Target,
) (Result, error) {
	if s == nil {
		return Result{}, nil
	}
	if s.relationReader != nil {
		normalized, err := s.relationReader.NormalizeTarget(ctx, actor, target)
		if err != nil {
			return Result{}, fmt.Errorf("normalize knowledge access target: %w", err)
		}
		target = normalized
	}
	operations, err := s.BatchOperations(ctx, actor, []string{target.KnowledgeBaseCode})
	if err != nil {
		return Result{}, err
	}
	operation := operations[target.KnowledgeBaseCode]
	return Result{
		Operation: operation,
		Target:    target,
	}, nil
}

// BatchOperations 返回知识库 code 到权限的映射。
func (s *Service) BatchOperations(
	ctx context.Context,
	actor Actor,
	knowledgeBaseCodes []string,
) (map[string]Operation, error) {
	if s == nil || s.permissionReader == nil {
		return map[string]Operation{}, nil
	}

	rawOperations, err := s.permissionReader.ListOperations(ctx, actor.OrganizationCode, actor.UserID, knowledgeBaseCodes)
	if err != nil {
		return nil, fmt.Errorf("list local knowledge access operations: %w", err)
	}
	operations := make(map[string]Operation, len(rawOperations))
	for code, rawOperation := range rawOperations {
		operations[code] = ParseOperation(rawOperation)
	}

	if s.externalReader == nil {
		return operations, nil
	}
	externalOperations, externalErr := s.externalReader.ListOperations(ctx, actor, knowledgeBaseCodes)
	if externalErr != nil {
		return nil, fmt.Errorf("list external knowledge access operations: %w", externalErr)
	}
	for code, operation := range externalOperations {
		if operation.StrongerThan(operations[code]) {
			operations[code] = operation
		}
	}

	return operations, nil
}

// AccessibleCodes 返回可读知识库 code 集合和权限快照。
func (s *Service) AccessibleCodes(
	ctx context.Context,
	actor Actor,
	requestedCodes []string,
) ([]string, map[string]Operation, error) {
	operations, err := s.BatchOperations(ctx, actor, requestedCodes)
	if err != nil {
		return nil, nil, err
	}

	if len(requestedCodes) > 0 {
		codes := make([]string, 0, len(requestedCodes))
		seen := make(map[string]struct{}, len(requestedCodes))
		for _, code := range requestedCodes {
			trimmed := strings.TrimSpace(code)
			if trimmed == "" {
				continue
			}
			if _, ok := seen[trimmed]; ok {
				continue
			}
			seen[trimmed] = struct{}{}
			if !operations[trimmed].CanRead() {
				continue
			}
			codes = append(codes, trimmed)
		}
		return codes, operations, nil
	}

	codes := make([]string, 0, len(operations))
	for code, operation := range operations {
		if operation.CanRead() {
			codes = append(codes, code)
		}
	}
	slices.Sort(codes)
	return codes, operations, nil
}

// Initialize 初始化知识库 owner/admin 权限。
func (s *Service) Initialize(
	ctx context.Context,
	actor Actor,
	input InitializeInput,
) error {
	if s == nil || s.permissionWriter == nil {
		return nil
	}
	if strings.TrimSpace(input.KnowledgeBaseCode) == "" || strings.TrimSpace(input.OwnerUserID) == "" {
		return nil
	}
	input.KnowledgeBaseCode = strings.TrimSpace(input.KnowledgeBaseCode)
	input.OwnerUserID = strings.TrimSpace(input.OwnerUserID)
	input.BusinessID = strings.TrimSpace(input.BusinessID)
	input.AdminUserIDs = normalizeUserIDs(input.AdminUserIDs)
	if err := s.permissionWriter.Initialize(ctx, actor, input); err != nil {
		return fmt.Errorf("initialize local knowledge permission: %w", err)
	}
	return nil
}

// GrantOwner 显式授予知识库 owner 权限。
func (s *Service) GrantOwner(
	ctx context.Context,
	actor Actor,
	knowledgeBaseCode string,
	ownerUserID string,
) error {
	if s == nil || s.permissionWriter == nil {
		return nil
	}
	knowledgeBaseCode = strings.TrimSpace(knowledgeBaseCode)
	ownerUserID = strings.TrimSpace(ownerUserID)
	if knowledgeBaseCode == "" || ownerUserID == "" {
		return nil
	}
	if err := s.permissionWriter.GrantOwner(ctx, actor, knowledgeBaseCode, ownerUserID); err != nil {
		return fmt.Errorf("grant local knowledge owner: %w", err)
	}
	return nil
}

// Cleanup 删除知识库本地权限。
func (s *Service) Cleanup(
	ctx context.Context,
	actor Actor,
	knowledgeBaseCode string,
) error {
	if s == nil || s.permissionWriter == nil {
		return nil
	}
	knowledgeBaseCode = strings.TrimSpace(knowledgeBaseCode)
	if knowledgeBaseCode == "" {
		return nil
	}
	if err := s.permissionWriter.Cleanup(ctx, actor, knowledgeBaseCode); err != nil {
		return fmt.Errorf("cleanup local knowledge permission: %w", err)
	}
	return nil
}

// Rebuild 批量补齐知识库 owner/admin 权限。
func (s *Service) Rebuild(
	ctx context.Context,
	items []RebuildItem,
) (int, error) {
	if s == nil || s.permissionWriter == nil || len(items) == 0 {
		return 0, nil
	}

	initialized := 0
	for _, item := range items {
		actor := Actor{
			OrganizationCode: strings.TrimSpace(item.OrganizationCode),
			UserID:           strings.TrimSpace(item.CurrentUserID),
		}
		if actor.OrganizationCode == "" || actor.UserID == "" {
			continue
		}
		if err := s.Initialize(ctx, actor, InitializeInput{
			KnowledgeBaseCode: item.KnowledgeBaseCode,
			OwnerUserID:       item.OwnerUserID,
			KnowledgeType:     item.KnowledgeType,
			BusinessID:        item.BusinessID,
			AdminUserIDs:      item.AdminUserIDs,
		}); err != nil {
			return initialized, fmt.Errorf("initialize knowledge base permission: %w", err)
		}
		initialized++
	}
	return initialized, nil
}

// ParseOperation 解析原始权限字符串。
func ParseOperation(raw string) Operation {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(OperationOwner):
		return OperationOwner
	case string(OperationAdmin):
		return OperationAdmin
	case string(OperationRead):
		return OperationRead
	case string(OperationEdit):
		return OperationEdit
	default:
		return OperationNone
	}
}

// CanRead 返回是否具备读权限。
func (op Operation) CanRead() bool {
	return op == OperationOwner || op == OperationAdmin || op == OperationRead || op == OperationEdit
}

// CanEdit 返回是否具备编辑权限。
func (op Operation) CanEdit() bool {
	return op == OperationOwner || op == OperationAdmin || op == OperationEdit
}

// CanDelete 返回是否具备删除权限。
func (op Operation) CanDelete() bool {
	return op == OperationOwner || op == OperationAdmin
}

// ValidateAction 返回权限是否允许执行指定动作。
func (op Operation) ValidateAction(action string) bool {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "read":
		return op.CanRead()
	case "edit":
		return op.CanEdit()
	case "delete":
		return op.CanDelete()
	default:
		return false
	}
}

// UserOperation 返回接口层 user_operation 整数值。
func (op Operation) UserOperation() int {
	switch op {
	case OperationOwner:
		return UserOperationOwner
	case OperationAdmin:
		return UserOperationAdmin
	case OperationRead:
		return UserOperationRead
	case OperationEdit:
		return UserOperationEdit
	default:
		return UserOperationNone
	}
}

func normalizeUserIDs(userIDs []string) []string {
	if len(userIDs) == 0 {
		return nil
	}

	normalized := make([]string, 0, len(userIDs))
	seen := make(map[string]struct{}, len(userIDs))
	for _, userID := range userIDs {
		trimmed := strings.TrimSpace(userID)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

// StrongerThan 返回当前权限是否强于另一个权限。
func (op Operation) StrongerThan(other Operation) bool {
	level := map[Operation]int{
		OperationOwner: operationStrengthOwner,
		OperationAdmin: operationStrengthAdmin,
		OperationEdit:  operationStrengthEdit,
		OperationRead:  operationStrengthRead,
		OperationNone:  operationStrengthNone,
	}
	if _, ok := level[op]; !ok {
		op = OperationNone
	}
	if _, ok := level[other]; !ok {
		other = OperationNone
	}
	return level[op] < level[other]
}
