// Package service 承接知识库级批量重新向量化用例。
//
// 这里单独拆一个 app，而不是继续把 Teamshare start-vector 散落在 RPC 层或 rebuild app 里，
// 是因为它表达的是“知识库级批量重向量化”这个独立用例：
// 需要统一编排知识库侧 prepare/materialize、文档侧异步 document_sync，以及 session 级进度统计。
// 这条链路不负责 rebuild 的模型切换、蓝绿切换和 cutover。
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	texthelper "magic/internal/application/knowledge/helper/text"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/infrastructure/logging"
)

var (
	// ErrKnowledgeBaseSupportRequired 表示缺少知识库侧协作能力。
	ErrKnowledgeBaseSupportRequired = errors.New("knowledge revectorize knowledge base support is required")
	// ErrDocumentSupportRequired 表示缺少文档侧协作能力。
	ErrDocumentSupportRequired = errors.New("knowledge revectorize document support is required")
)

type knowledgeBaseSupport interface {
	PrepareTeamshareKnowledgeRevectorize(
		ctx context.Context,
		input *revectorizeshared.TeamshareStartInput,
	) (*revectorizeshared.TeamshareStartResult, error)
	ListManagedDocumentsForKnowledgeBase(
		ctx context.Context,
		knowledgeBaseCode string,
	) ([]*revectorizeshared.ManagedDocument, error)
	SaveRevectorizeProgress(ctx context.Context, input *revectorizeshared.SaveProcessInput) error
}

type documentSupport interface {
	ScheduleSync(ctx context.Context, input *documentdomain.SyncDocumentInput)
}

// KnowledgeRevectorizeAppService 统一承接知识库级批量重向量化用例。
//
// knowledgebase app 仍只负责知识库侧的接管/prepare/materialize，
// document app 仍只负责单文档异步执行；
// 这个 app 只负责把两侧能力收敛成一个完整用例，避免 API 层再去串多个 app。
type KnowledgeRevectorizeAppService struct {
	knowledgeBase knowledgeBaseSupport
	document      documentSupport
	progressStore revectorizeshared.ProgressStore
	logger        *logging.SugaredLogger
}

// NewKnowledgeRevectorizeAppService 创建知识库重向量化应用服务。
func NewKnowledgeRevectorizeAppService(
	knowledgeBase knowledgeBaseSupport,
	document documentSupport,
	progressStore revectorizeshared.ProgressStore,
	logger *logging.SugaredLogger,
) *KnowledgeRevectorizeAppService {
	return &KnowledgeRevectorizeAppService{
		knowledgeBase: knowledgeBase,
		document:      document,
		progressStore: progressStore,
		logger:        logger,
	}
}

// TeamshareStartVector 承接 Teamshare start-vector 的知识库级批量重向量化编排。
//
// 这条链路的批量范围只限于当前 knowledge_id 接管出来的那个内部知识库，
// 也就是“单知识库下的 managed documents 批量重向量化”。
// 它不是 third-file 广播入口，不能扩散到别的知识库。
func (s *KnowledgeRevectorizeAppService) TeamshareStartVector(
	ctx context.Context,
	input *revectorizeshared.TeamshareStartInput,
) (*revectorizeshared.TeamshareStartResult, error) {
	if s == nil || s.knowledgeBase == nil {
		return nil, ErrKnowledgeBaseSupportRequired
	}
	if s.document == nil {
		return nil, ErrDocumentSupportRequired
	}
	if s.progressStore == nil {
		return nil, revectorizeshared.ErrProgressStoreRequired
	}

	prepareResult, err := s.knowledgeBase.PrepareTeamshareKnowledgeRevectorize(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("prepare teamshare knowledge revectorize: %w", err)
	}

	knowledgeCode := strings.TrimSpace(prepareResult.KnowledgeCode)
	managedDocuments, err := s.knowledgeBase.ListManagedDocumentsForKnowledgeBase(ctx, knowledgeCode)
	if err != nil {
		return nil, fmt.Errorf("list managed documents for knowledge revectorize: %w", err)
	}

	documentCodes := collectDocumentCodes(managedDocuments)
	sessionID, progress, err := s.startRevectorizeSession(ctx, input, knowledgeCode, documentCodes)
	if err != nil {
		return nil, err
	}

	s.scheduleManagedDocuments(ctx, input, knowledgeCode, sessionID, managedDocuments)
	s.logScheduledSession(ctx, input, knowledgeCode, sessionID, progress.ExpectedNum)

	return &revectorizeshared.TeamshareStartResult{
		ID:            knowledgeCode,
		KnowledgeCode: knowledgeCode,
	}, nil
}

func collectDocumentCodes(managedDocuments []*revectorizeshared.ManagedDocument) []string {
	documentCodes := make([]string, 0, len(managedDocuments))
	for _, doc := range managedDocuments {
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		documentCodes = append(documentCodes, doc.Code)
	}
	return documentCodes
}

func (s *KnowledgeRevectorizeAppService) startRevectorizeSession(
	ctx context.Context,
	input *revectorizeshared.TeamshareStartInput,
	knowledgeCode string,
	documentCodes []string,
) (string, *revectorizeshared.SessionProgress, error) {
	sessionID := uuid.NewString()
	progress, err := s.progressStore.StartSession(ctx, knowledgeCode, sessionID, documentCodes)
	if err != nil {
		return "", nil, fmt.Errorf("start knowledge revectorize session: %w", err)
	}
	if progress == nil {
		progress = &revectorizeshared.SessionProgress{KnowledgeBaseCode: knowledgeCode, SessionID: sessionID}
	}
	if strings.TrimSpace(progress.SessionID) != "" {
		sessionID = strings.TrimSpace(progress.SessionID)
	}
	if err := s.knowledgeBase.SaveRevectorizeProgress(ctx, &revectorizeshared.SaveProcessInput{
		OrganizationCode: input.OrganizationCode,
		UserID:           input.UserID,
		Code:             knowledgeCode,
		ExpectedNum:      progress.ExpectedNum,
		CompletedNum:     progress.CompletedNum,
	}); err != nil {
		return "", nil, fmt.Errorf("initialize knowledge revectorize progress: %w", err)
	}
	return sessionID, progress, nil
}

func (s *KnowledgeRevectorizeAppService) scheduleManagedDocuments(
	ctx context.Context,
	input *revectorizeshared.TeamshareStartInput,
	knowledgeCode string,
	sessionID string,
	managedDocuments []*revectorizeshared.ManagedDocument,
) {
	businessParams := texthelper.BuildCreateBusinessParams(
		input.OrganizationCode,
		input.UserID,
		knowledgeCode,
	)
	for _, doc := range managedDocuments {
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		s.document.ScheduleSync(ctx, &documentdomain.SyncDocumentInput{
			OrganizationCode:                  input.OrganizationCode,
			KnowledgeBaseCode:                 knowledgeCode,
			Code:                              doc.Code,
			Mode:                              documentdomain.SyncModeResync,
			Async:                             true,
			BusinessParams:                    businessParams,
			RevectorizeSource:                 documentdomain.RevectorizeSourceTeamshareKnowledgeStartVector,
			SingleDocumentThirdPlatformResync: true,
			RevectorizeSessionID:              sessionID,
		})
	}
}

func (s *KnowledgeRevectorizeAppService) logScheduledSession(
	ctx context.Context,
	input *revectorizeshared.TeamshareStartInput,
	knowledgeCode string,
	sessionID string,
	documentCount int,
) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.InfoContext(
		ctx,
		"Knowledge revectorize session scheduled",
		"organization_code", input.OrganizationCode,
		"knowledge_base_code", knowledgeCode,
		"session_id", sessionID,
		"document_count", documentCount,
		"revectorize_source", documentdomain.RevectorizeSourceTeamshareKnowledgeStartVector,
		"target_scope", "knowledge_base_documents",
		"target_count", documentCount,
	)
}
