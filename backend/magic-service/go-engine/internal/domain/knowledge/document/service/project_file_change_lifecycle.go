package document

import (
	"context"
	"errors"
	"fmt"

	"magic/internal/pkg/projectfile"
)

var (
	// ErrProjectFileChangeLifecycleOperatorNil 表示生命周期缺少执行端口。
	ErrProjectFileChangeLifecycleOperatorNil = errors.New("project file change lifecycle operator is nil")
	// ErrProjectFileChangeLifecycleResolverNil 表示企业源解析端口缺失。
	ErrProjectFileChangeLifecycleResolverNil = errors.New("project file change lifecycle resolver is nil")
	// ErrProjectFileChangeLifecycleMetaRequired 表示缺少项目文件元数据。
	ErrProjectFileChangeLifecycleMetaRequired = errors.New("project file change meta is required")
	// ErrProjectFileChangeLifecycleDocumentCodeRequired 表示创建出的文档编码为空。
	ErrProjectFileChangeLifecycleDocumentCodeRequired = errors.New("project file change created document code is required")
)

// ProjectFileChangeSource 描述 project-file lifecycle 使用的稳定源。
type ProjectFileChangeSource struct {
	Resolved *projectfile.ResolveResult
	Override *SourceOverride
}

// ProjectFileChangeCreateDocumentInput 描述 project-file lifecycle 的建文档输入。
type ProjectFileChangeCreateDocumentInput struct {
	Target   ProjectFileCreateTarget
	Resolved *projectfile.ResolveResult
	Override *SourceOverride
}

// ProjectFileChangeSourceResolver 定义企业项目文件源解析能力。
type ProjectFileChangeSourceResolver interface {
	ResolveEnterpriseSource(ctx context.Context, projectFileID int64) (ProjectFileChangeSource, error)
}

// ProjectFileChangeOperator 定义 project-file lifecycle 的执行端口。
type ProjectFileChangeOperator interface {
	DestroyDocument(ctx context.Context, doc *KnowledgeBaseDocument) error
	CreateManagedDocument(ctx context.Context, input ProjectFileChangeCreateDocumentInput) (string, error)
	ScheduleSync(ctx context.Context, input *SyncDocumentInput)
}

// ProjectFileChangeLifecycleInput 描述一次项目文件变更生命周期所需上下文。
type ProjectFileChangeLifecycleInput struct {
	ProjectFileID                    int64
	Meta                             *projectfile.Meta
	Bindings                         []ProjectFileBindingRef
	Documents                        []*KnowledgeBaseDocument
	UseSourceOverrideByKnowledgeBase map[string]bool
}

// ProjectFileChangeLifecycleService 收敛项目文件变更生命周期主流程。
type ProjectFileChangeLifecycleService struct {
	resolver ProjectFileChangeSourceResolver
	operator ProjectFileChangeOperator
}

// NewProjectFileChangeLifecycleService 创建项目文件变更生命周期服务。
func NewProjectFileChangeLifecycleService(
	resolver ProjectFileChangeSourceResolver,
	operator ProjectFileChangeOperator,
) *ProjectFileChangeLifecycleService {
	return &ProjectFileChangeLifecycleService{
		resolver: resolver,
		operator: operator,
	}
}

// Handle 执行一次项目文件变更生命周期。
func (s *ProjectFileChangeLifecycleService) Handle(ctx context.Context, input ProjectFileChangeLifecycleInput) error {
	if err := s.validateInput(input); err != nil {
		return err
	}

	plan := BuildProjectFileChangePlan(
		input.Meta,
		input.Bindings,
		input.Documents,
		input.UseSourceOverrideByKnowledgeBase,
	)
	if err := s.destroyDocuments(ctx, plan.DeleteDocuments); err != nil {
		return err
	}
	if plan.Ignore || len(plan.DeleteDocuments) > 0 {
		return nil
	}

	enterpriseSource, err := s.resolveEnterpriseSource(ctx, input.ProjectFileID, plan.NeedEnterpriseResolution)
	if err != nil {
		return err
	}
	standardSource := ProjectFileChangeSource{
		Resolved: ProjectFileMetaToResolved(input.Meta),
	}

	if err := s.executeGroup(ctx, plan.Standard, standardSource); err != nil {
		return err
	}
	return s.executeGroup(ctx, plan.Enterprise, enterpriseSource)
}

func (s *ProjectFileChangeLifecycleService) validateInput(input ProjectFileChangeLifecycleInput) error {
	switch {
	case s == nil || s.operator == nil:
		return ErrProjectFileChangeLifecycleOperatorNil
	case input.Meta == nil:
		return ErrProjectFileChangeLifecycleMetaRequired
	default:
		return nil
	}
}

func (s *ProjectFileChangeLifecycleService) destroyDocuments(
	ctx context.Context,
	docs []*KnowledgeBaseDocument,
) error {
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		if err := s.operator.DestroyDocument(ctx, doc); err != nil {
			return fmt.Errorf("destroy project document %s: %w", doc.Code, err)
		}
	}
	return nil
}

func (s *ProjectFileChangeLifecycleService) resolveEnterpriseSource(
	ctx context.Context,
	projectFileID int64,
	needEnterpriseResolution bool,
) (ProjectFileChangeSource, error) {
	if !needEnterpriseResolution {
		return ProjectFileChangeSource{}, nil
	}
	if s.resolver == nil {
		return ProjectFileChangeSource{}, ErrProjectFileChangeLifecycleResolverNil
	}
	source, err := s.resolver.ResolveEnterpriseSource(ctx, projectFileID)
	if err != nil {
		return ProjectFileChangeSource{}, fmt.Errorf("resolve enterprise project file source: %w", err)
	}
	return source, nil
}

func (s *ProjectFileChangeLifecycleService) executeGroup(
	ctx context.Context,
	group ProjectFileChangeActionGroup,
	source ProjectFileChangeSource,
) error {
	for _, request := range group.ResyncRequests {
		s.operator.ScheduleSync(ctx, cloneProjectFileSyncRequest(request, source.Override))
	}

	for _, target := range group.CreateTargets {
		documentCode, err := s.operator.CreateManagedDocument(ctx, ProjectFileChangeCreateDocumentInput{
			Target:   target,
			Resolved: source.Resolved,
			Override: CloneProjectSourceOverride(source.Override),
		})
		if err != nil {
			return fmt.Errorf("create project file document: %w", err)
		}
		if documentCode == "" {
			return ErrProjectFileChangeLifecycleDocumentCodeRequired
		}
		s.operator.ScheduleSync(ctx, buildProjectFileCreateSyncRequest(target, documentCode, source.Override))
	}
	return nil
}

func cloneProjectFileSyncRequest(input *SyncDocumentInput, override *SourceOverride) *SyncDocumentInput {
	if input == nil {
		return nil
	}
	cloned := *input
	cloned.SourceOverride = CloneProjectSourceOverride(override)
	return &cloned
}

func buildProjectFileCreateSyncRequest(
	target ProjectFileCreateTarget,
	documentCode string,
	override *SourceOverride,
) *SyncDocumentInput {
	return &SyncDocumentInput{
		OrganizationCode:  target.OrganizationCode,
		KnowledgeBaseCode: target.KnowledgeBaseCode,
		Code:              documentCode,
		Mode:              SyncModeCreate,
		Async:             true,
		BusinessParams:    buildSyncBusinessParams(target.OrganizationCode, target.UserID, target.KnowledgeBaseCode),
		SourceOverride:    CloneProjectSourceOverride(override),
	}
}
