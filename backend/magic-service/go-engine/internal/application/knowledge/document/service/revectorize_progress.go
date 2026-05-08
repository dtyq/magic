package docapp

import (
	"context"
	"fmt"
	"strings"

	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
	documentdomain "magic/internal/domain/knowledge/document/service"
)

// FinalizeKnowledgeRevectorizeTask 在 session-scoped document_sync 结束后推进知识库级进度。
//
// 这里显式把知识库级 completed_num 的推进放在 document app，而不是 knowledgebase app，
// 是因为只有 document app 知道“单文档任务何时真正进入终态”。
func (s *DocumentAppService) FinalizeKnowledgeRevectorizeTask(
	ctx context.Context,
	input *documentdomain.SyncDocumentInput,
) error {
	if s == nil || input == nil || s.revectorizeProgressStore == nil {
		return nil
	}

	sessionID := strings.TrimSpace(input.RevectorizeSessionID)
	if sessionID == "" || strings.TrimSpace(input.KnowledgeBaseCode) == "" || strings.TrimSpace(input.Code) == "" {
		return nil
	}

	advanced, err := s.revectorizeProgressStore.AdvanceDocument(
		ctx,
		input.KnowledgeBaseCode,
		sessionID,
		input.Code,
		func(progress *revectorizeshared.SessionProgress) error {
			return s.persistKnowledgeRevectorizeProgress(ctx, input, sessionID, progress)
		},
	)
	if err != nil {
		return fmt.Errorf("advance knowledge revectorize progress: %w", err)
	}
	if !advanced {
		return nil
	}
	return nil
}

func (s *DocumentAppService) persistKnowledgeRevectorizeProgress(
	ctx context.Context,
	input *documentdomain.SyncDocumentInput,
	sessionID string,
	progress *revectorizeshared.SessionProgress,
) error {
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, input.KnowledgeBaseCode, input.OrganizationCode)
	if err != nil {
		return fmt.Errorf("load knowledge base for revectorize progress update: %w", err)
	}

	kb.SetProgress(progress.ExpectedNum, progress.CompletedNum, businessParamsUserID(input.BusinessParams))
	if err := s.kbService.UpdateProgress(ctx, kb); err != nil {
		return fmt.Errorf(
			"persist knowledge revectorize progress for knowledge_base=%s document=%s session=%s expected=%d completed=%d: %w",
			input.KnowledgeBaseCode,
			input.Code,
			sessionID,
			progress.ExpectedNum,
			progress.CompletedNum,
			err,
		)
	}
	return nil
}
