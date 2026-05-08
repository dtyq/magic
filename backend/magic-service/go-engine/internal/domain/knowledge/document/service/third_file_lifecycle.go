package document

import (
	"context"
	"errors"
	"fmt"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
)

var (
	// ErrThirdFileRevectorizeLifecyclePlannerNil 表示 third-file 生命周期缺少文档规划器。
	ErrThirdFileRevectorizeLifecyclePlannerNil = errors.New("third-file revectorize lifecycle planner is nil")
	// ErrThirdFileRevectorizeLifecycleProviderGuardNil 表示 third-file 生命周期缺少 provider 校验器。
	ErrThirdFileRevectorizeLifecycleProviderGuardNil = errors.New("third-file revectorize lifecycle provider guard is nil")
	// ErrThirdFileRevectorizeLifecycleSnapshotResolverNil 表示 third-file 生命周期缺少源快照解析器。
	ErrThirdFileRevectorizeLifecycleSnapshotResolverNil = errors.New("third-file revectorize lifecycle snapshot resolver is nil")
)

// ThirdFileProviderGuard 定义 third-file 生命周期需要的 provider 校验能力。
type ThirdFileProviderGuard interface {
	EnsureThirdFileProvider(platformType string) error
}

// ThirdFileSourceSnapshotResolver 定义 third-file 生命周期需要的源快照解析能力。
type ThirdFileSourceSnapshotResolver interface {
	ResolveThirdFileSourceSnapshot(
		ctx context.Context,
		input *ThirdFileRevectorizeInput,
		seed *ThirdFileRevectorizeSeed,
	) (*ResolvedSourceSnapshot, error)
}

// ThirdFileRevectorizeLifecycleInput 描述一次 third-file 重向量化生命周期输入。
type ThirdFileRevectorizeLifecycleInput struct {
	Task  *ThirdFileRevectorizeInput
	Async bool
}

// ThirdFileRevectorizeExecutionPlan 描述 third-file 重向量化生命周期产出的执行计划。
type ThirdFileRevectorizeExecutionPlan struct {
	Task     *ThirdFileRevectorizeInput
	Requests []*SyncDocumentInput
}

// ThirdFileRevectorizeLifecycleService 收敛 third-file 重向量化生命周期。
type ThirdFileRevectorizeLifecycleService struct {
	planner          ThirdFilePlanner
	providerGuard    ThirdFileProviderGuard
	snapshotResolver ThirdFileSourceSnapshotResolver
}

// NewThirdFileRevectorizeLifecycleService 创建 third-file 重向量化生命周期服务。
func NewThirdFileRevectorizeLifecycleService(
	planner ThirdFilePlanner,
	providerGuard ThirdFileProviderGuard,
	snapshotResolver ThirdFileSourceSnapshotResolver,
) *ThirdFileRevectorizeLifecycleService {
	return &ThirdFileRevectorizeLifecycleService{
		planner:          planner,
		providerGuard:    providerGuard,
		snapshotResolver: snapshotResolver,
	}
}

// Plan 构造一次 third-file 重向量化执行计划。
func (s *ThirdFileRevectorizeLifecycleService) Plan(
	ctx context.Context,
	input ThirdFileRevectorizeLifecycleInput,
) (ThirdFileRevectorizeExecutionPlan, error) {
	task, err := s.validateInput(input)
	if err != nil {
		return ThirdFileRevectorizeExecutionPlan{}, err
	}

	plan, err := s.planner.ResolveThirdFileDocumentPlan(ctx, ThirdFileDocumentPlanInput{
		OrganizationCode:  task.OrganizationCode,
		ThirdPlatformType: task.ThirdPlatformType,
		ThirdFileID:       task.ThirdFileID,
	})
	if err != nil {
		return ThirdFileRevectorizeExecutionPlan{}, fmt.Errorf("resolve third-file document plan: %w", err)
	}
	if err := s.providerGuard.EnsureThirdFileProvider(task.ThirdPlatformType); err != nil {
		return ThirdFileRevectorizeExecutionPlan{}, fmt.Errorf("ensure third-file provider: %w", err)
	}

	snapshot, err := s.snapshotResolver.ResolveThirdFileSourceSnapshot(ctx, task, plan.Seed)
	if err != nil {
		return ThirdFileRevectorizeExecutionPlan{}, fmt.Errorf("resolve third-file source snapshot: %w", err)
	}

	return ThirdFileRevectorizeExecutionPlan{
		Task:     task,
		Requests: s.buildRequests(input.Async, task, plan.Documents, plan.Seed, snapshot),
	}, nil
}

func (s *ThirdFileRevectorizeLifecycleService) validateInput(
	input ThirdFileRevectorizeLifecycleInput,
) (*ThirdFileRevectorizeInput, error) {
	switch {
	case s == nil || s.planner == nil:
		return nil, ErrThirdFileRevectorizeLifecyclePlannerNil
	case s.providerGuard == nil:
		return nil, ErrThirdFileRevectorizeLifecycleProviderGuardNil
	case s.snapshotResolver == nil:
		return nil, ErrThirdFileRevectorizeLifecycleSnapshotResolverNil
	}

	task := NormalizeThirdFileRevectorizeInput(input.Task)
	if task == nil || task.OrganizationCode == "" || task.ThirdPlatformType == "" || task.ThirdFileID == "" {
		return nil, shared.ErrDocumentNotFound
	}
	return task, nil
}

func (s *ThirdFileRevectorizeLifecycleService) buildRequests(
	async bool,
	task *ThirdFileRevectorizeInput,
	docs []*docentity.KnowledgeBaseDocument,
	seed *ThirdFileRevectorizeSeed,
	snapshot *ResolvedSourceSnapshot,
) []*SyncDocumentInput {
	requests := BuildThirdFileRevectorizeRequests(task, docs, seed, snapshot)
	if len(requests) == 0 {
		return nil
	}

	planned := make([]*SyncDocumentInput, 0, len(requests))
	for _, request := range requests {
		if request == nil {
			continue
		}
		cloned := *request
		cloned.Async = async
		planned = append(planned, &cloned)
	}
	return planned
}
