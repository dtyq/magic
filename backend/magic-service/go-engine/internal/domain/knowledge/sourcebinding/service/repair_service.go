package sourcebinding

import (
	"context"
	"errors"
	"fmt"
	"strings"

	thirdfilemappingpkg "magic/internal/pkg/thirdfilemapping"
)

var (
	// ErrRepairSourceBindingDocumentNotMapped 表示 repair 后仍未找到第三方文件对应的托管文档。
	ErrRepairSourceBindingDocumentNotMapped = errors.New("no managed document mapped for third file")

	errRepairKnowledgeBaseRequired = errors.New("repair knowledge base is required")
)

// RepairKnowledgeBase 表示 repair 生命周期所需的知识库快照。
type RepairKnowledgeBase struct {
	Code             string
	OrganizationCode string
	CreatedUID       string
	UpdatedUID       string
}

// RepairKnowledgeBaseLoader 定义 repair 生命周期所需的知识库加载能力。
type RepairKnowledgeBaseLoader interface {
	LoadRepairKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
		organizationCode string,
	) (*RepairKnowledgeBase, error)
}

// RepairBindingRepository 定义 repair 生命周期所需的 source binding 持久化能力。
type RepairBindingRepository interface {
	ListBindingsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]Binding, error)
	ReplaceBindings(ctx context.Context, knowledgeBaseCode string, bindings []Binding) ([]Binding, error)
	SaveBindings(ctx context.Context, knowledgeBaseCode string, bindings []Binding) ([]Binding, error)
}

// RepairDocumentStore 定义 repair 生命周期所需的托管文档读写能力。
type RepairDocumentStore interface {
	ListManagedDocumentCodeByThirdFile(
		ctx context.Context,
		knowledgeBaseCode string,
		thirdPlatformType string,
	) (map[string]string, error)
	DestroyKnowledgeBaseDocuments(
		ctx context.Context,
		knowledgeBaseCode string,
		organizationCode string,
	) error
}

// RepairMaterializer 定义 repair 过程中 source binding 文档物化能力。
type RepairMaterializer interface {
	Materialize(ctx context.Context, input MaterializationInput) (int, error)
}

// RepairBackfillInput 表示 fragment 文档编码回填请求。
type RepairBackfillInput struct {
	OrganizationCode string
	KnowledgeCode    string
	ThirdFileID      string
	DocumentCode     string
}

// RepairFragmentBackfiller 定义 fragment 文档编码回填能力。
type RepairFragmentBackfiller interface {
	BackfillDocumentCodeByThirdFile(ctx context.Context, input RepairBackfillInput) (int64, error)
}

// RepairKnowledgeInput 表示单个知识库的 source binding repair 输入。
type RepairKnowledgeInput struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	UserID            string
	ThirdPlatformType string
	Groups            []thirdfilemappingpkg.RepairGroup
}

// RepairFailure 表示 repair 生命周期中的非致命失败。
type RepairFailure struct {
	ThirdFileID string
	Err         error
}

// RepairKnowledgeResult 表示单个知识库的 repair 执行结果。
type RepairKnowledgeResult struct {
	CandidateBindings int
	AddedBindings     int
	MaterializedDocs  int
	BackfilledRows    int
	ReusedDocuments   int
	Failures          []RepairFailure
}

// RepairService 收敛 source binding repair/reconcile 生命周期。
type RepairService struct {
	knowledgeBaseLoader RepairKnowledgeBaseLoader
	repo                RepairBindingRepository
	documentStore       RepairDocumentStore
	materializer        RepairMaterializer
	backfiller          RepairFragmentBackfiller
}

// NewRepairService 创建 source binding repair 生命周期服务。
func NewRepairService(
	knowledgeBaseLoader RepairKnowledgeBaseLoader,
	repo RepairBindingRepository,
	documentStore RepairDocumentStore,
	materializer RepairMaterializer,
	backfiller RepairFragmentBackfiller,
) *RepairService {
	return &RepairService{
		knowledgeBaseLoader: knowledgeBaseLoader,
		repo:                repo,
		documentStore:       documentStore,
		materializer:        materializer,
		backfiller:          backfiller,
	}
}

// RepairKnowledge 执行单个知识库的 repair/reconcile 生命周期。
func (s *RepairService) RepairKnowledge(
	ctx context.Context,
	input RepairKnowledgeInput,
) (RepairKnowledgeResult, error) {
	knowledgeBase, err := s.loadKnowledgeBase(ctx, input)
	if err != nil {
		return RepairKnowledgeResult{}, err
	}

	existingBindings, err := s.listBindings(ctx, knowledgeBase.Code)
	if err != nil {
		return RepairKnowledgeResult{}, err
	}
	preExistingDocCodes, err := s.listManagedDocumentCodes(ctx, knowledgeBase.Code, input.ThirdPlatformType)
	if err != nil {
		return RepairKnowledgeResult{}, err
	}
	newBindings := PlanLegacyTeamshareBindings(
		knowledgeBase.OrganizationCode,
		knowledgeBase.Code,
		input.UserID,
		existingBindings,
		input.Groups,
	)

	result := RepairKnowledgeResult{
		CandidateBindings: len(newBindings),
		Failures:          make([]RepairFailure, 0, len(input.Groups)),
	}

	savedBindings, err := s.persistBindings(ctx, knowledgeBase, existingBindings, newBindings)
	if err != nil {
		return RepairKnowledgeResult{}, err
	}

	result.AddedBindings = len(savedBindings)
	result.MaterializedDocs, err = s.materializeBindings(ctx, knowledgeBase, input.UserID, savedBindings)
	if err != nil {
		return RepairKnowledgeResult{}, err
	}
	result.BackfilledRows, result.ReusedDocuments, result.Failures, err = s.backfillGroups(
		ctx,
		knowledgeBase,
		input,
		preExistingDocCodes,
	)
	if err != nil {
		return RepairKnowledgeResult{}, err
	}

	return result, nil
}

func (s *RepairService) loadKnowledgeBase(
	ctx context.Context,
	input RepairKnowledgeInput,
) (*RepairKnowledgeBase, error) {
	knowledgeBase, err := s.knowledgeBaseLoader.LoadRepairKnowledgeBase(
		ctx,
		strings.TrimSpace(input.KnowledgeBaseCode),
		strings.TrimSpace(input.OrganizationCode),
	)
	if err != nil {
		return nil, fmt.Errorf("load repair knowledge base: %w", err)
	}
	return knowledgeBase, nil
}

func (s *RepairService) listBindings(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]Binding, error) {
	bindings, err := s.repo.ListBindingsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("list source bindings by knowledge base: %w", err)
	}
	return bindings, nil
}

func (s *RepairService) listManagedDocumentCodes(
	ctx context.Context,
	knowledgeBaseCode string,
	thirdPlatformType string,
) (map[string]string, error) {
	docCodes, err := s.documentStore.ListManagedDocumentCodeByThirdFile(ctx, knowledgeBaseCode, thirdPlatformType)
	if err != nil {
		return nil, fmt.Errorf("list managed document code by third file: %w", err)
	}
	return docCodes, nil
}

func (s *RepairService) materializeBindings(
	ctx context.Context,
	knowledgeBase *RepairKnowledgeBase,
	userID string,
	savedBindings []Binding,
) (int, error) {
	if len(savedBindings) == 0 {
		return 0, nil
	}
	materializedCount, err := s.materializer.Materialize(ctx, MaterializationInput{
		KnowledgeBaseCode:   knowledgeBase.Code,
		OrganizationCode:    knowledgeBase.OrganizationCode,
		KnowledgeBaseUserID: strings.TrimSpace(knowledgeBase.UpdatedUID),
		KnowledgeBaseOwner:  strings.TrimSpace(knowledgeBase.CreatedUID),
		FallbackUserID:      strings.TrimSpace(userID),
		Bindings:            savedBindings,
		ScheduleSync:        true,
	})
	if err != nil {
		return 0, fmt.Errorf("materialize source binding documents: %w", err)
	}
	return materializedCount, nil
}

func (s *RepairService) backfillGroups(
	ctx context.Context,
	knowledgeBase *RepairKnowledgeBase,
	input RepairKnowledgeInput,
	preExistingDocCodes map[string]string,
) (int, int, []RepairFailure, error) {
	currentDocCodes, err := s.listManagedDocumentCodes(ctx, knowledgeBase.Code, input.ThirdPlatformType)
	if err != nil {
		return 0, 0, nil, err
	}

	backfilledRows := 0
	reusedDocuments := 0
	failures := make([]RepairFailure, 0, len(input.Groups))
	for _, group := range input.Groups {
		if group.MissingDocumentCodeCount <= 0 {
			continue
		}
		rows, reused, failure := s.backfillGroup(
			ctx,
			knowledgeBase,
			group,
			currentDocCodes,
			preExistingDocCodes,
		)
		backfilledRows += rows
		reusedDocuments += reused
		if failure.Err != nil {
			failures = append(failures, failure)
		}
	}
	return backfilledRows, reusedDocuments, failures, nil
}

func (s *RepairService) backfillGroup(
	ctx context.Context,
	knowledgeBase *RepairKnowledgeBase,
	group thirdfilemappingpkg.RepairGroup,
	currentDocCodes map[string]string,
	preExistingDocCodes map[string]string,
) (int, int, RepairFailure) {
	thirdFileID := strings.TrimSpace(group.ThirdFileID)
	documentCode := strings.TrimSpace(currentDocCodes[thirdFileID])
	if documentCode == "" {
		return 0, 0, RepairFailure{
			ThirdFileID: thirdFileID,
			Err:         ErrRepairSourceBindingDocumentNotMapped,
		}
	}

	rows, err := s.backfiller.BackfillDocumentCodeByThirdFile(ctx, RepairBackfillInput{
		OrganizationCode: knowledgeBase.OrganizationCode,
		KnowledgeCode:    knowledgeBase.Code,
		ThirdFileID:      thirdFileID,
		DocumentCode:     documentCode,
	})
	if err != nil {
		return 0, 0, RepairFailure{
			ThirdFileID: thirdFileID,
			Err:         err,
		}
	}

	reusedDocuments := 0
	if rows > 0 && strings.TrimSpace(preExistingDocCodes[thirdFileID]) != "" {
		reusedDocuments = 1
	}
	return int(rows), reusedDocuments, RepairFailure{}
}

func (s *RepairService) persistBindings(
	ctx context.Context,
	knowledgeBase *RepairKnowledgeBase,
	existingBindings []Binding,
	newBindings []Binding,
) ([]Binding, error) {
	if len(newBindings) == 0 {
		return nil, nil
	}
	if knowledgeBase == nil {
		return nil, errRepairKnowledgeBaseRequired
	}
	knowledgeBaseCode := knowledgeBase.Code

	if len(existingBindings) == 0 {
		savedBindings, err := s.repo.ReplaceBindings(ctx, knowledgeBaseCode, newBindings)
		if err != nil {
			return nil, fmt.Errorf("replace source bindings during repair: %w", err)
		}
		if err := s.documentStore.DestroyKnowledgeBaseDocuments(ctx, knowledgeBaseCode, knowledgeBase.OrganizationCode); err != nil {
			return nil, fmt.Errorf("destroy knowledge base documents during repair: %w", err)
		}
		return savedBindings, nil
	}

	savedBindings, err := s.repo.SaveBindings(ctx, knowledgeBaseCode, newBindings)
	if err != nil {
		return nil, fmt.Errorf("save source bindings during repair: %w", err)
	}
	return savedBindings, nil
}
