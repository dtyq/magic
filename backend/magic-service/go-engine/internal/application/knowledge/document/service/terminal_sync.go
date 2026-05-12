package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgeshared "magic/internal/domain/knowledge/shared"
)

// FinalizeTerminalDocumentSyncTask 在 MQ 重试耗尽后把文档同步任务落到业务终态。
//
// 这里由 document app 承接，是因为只有 document app 同时知道文档失败态落库
// 和 revectorize session 进度推进这两个动作。
func (s *DocumentAppService) FinalizeTerminalDocumentSyncTask(
	ctx context.Context,
	input *documentdomain.SyncDocumentInput,
	cause error,
) error {
	if s == nil || input == nil {
		return nil
	}

	if err := s.markTerminalDocumentSyncFailed(ctx, input, cause); err != nil {
		return err
	}
	if strings.TrimSpace(input.RevectorizeSessionID) == "" {
		return nil
	}
	if err := s.FinalizeKnowledgeRevectorizeTask(ctx, input); err != nil {
		return fmt.Errorf("finalize terminal knowledge revectorize task: %w", err)
	}
	return nil
}

func (s *DocumentAppService) markTerminalDocumentSyncFailed(
	ctx context.Context,
	input *documentdomain.SyncDocumentInput,
	cause error,
) error {
	doc, err := s.fetchDocumentForSync(ctx, input)
	if err != nil {
		if errors.Is(err, ErrDocumentAccessActorMissing) && doc != nil {
			message := documentdomain.BuildTerminalSyncFailureMessage(cause)
			if markErr := s.domainService.MarkSyncFailed(ctx, doc, message); markErr != nil {
				return fmt.Errorf("mark terminal document sync failed: %w", markErr)
			}
			return nil
		}
		if isTerminalDocumentLookupError(err) {
			s.logTerminalDocumentSyncSkipped(ctx, input, err)
			return nil
		}
		return fmt.Errorf("load terminal document sync task: %w", err)
	}

	message := documentdomain.BuildTerminalSyncFailureMessage(cause)
	if err := s.domainService.MarkSyncFailed(ctx, doc, message); err != nil {
		return fmt.Errorf("mark terminal document sync failed: %w", err)
	}
	return nil
}

func isTerminalDocumentLookupError(err error) bool {
	return errors.Is(err, knowledgeshared.ErrDocumentNotFound) ||
		errors.Is(err, knowledgeshared.ErrKnowledgeBaseNotFound) ||
		errors.Is(err, knowledgeshared.ErrDocumentKnowledgeBaseRequired) ||
		errors.Is(err, ErrDocumentOrgMismatch) ||
		errors.Is(err, ErrDocumentPermissionDenied) ||
		errors.Is(err, ErrDocumentAccessActorMissing)
}

func (s *DocumentAppService) logTerminalDocumentSyncSkipped(
	ctx context.Context,
	input *documentdomain.SyncDocumentInput,
	err error,
) {
	if s == nil || s.logger == nil || input == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Skip marking terminal document sync failed because document is unavailable",
		"organization_code", input.OrganizationCode,
		"knowledge_base_code", input.KnowledgeBaseCode,
		"document_code", input.Code,
		"revectorize_session_id", input.RevectorizeSessionID,
		"error", err,
	)
}
