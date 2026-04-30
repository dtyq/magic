package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	texthelper "magic/internal/application/knowledge/helper/text"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/ctxmeta"
)

func (s *DocumentAppService) scheduleDocumentUpdateResync(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	userID string,
) {
	request := s.buildDocumentUpdateResyncRequest(ctx, doc, userID)
	if request == nil {
		return
	}
	s.ScheduleSync(ctx, request)
}

func (s *DocumentAppService) buildDocumentUpdateResyncRequest(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	userID string,
) *documentdomain.SyncDocumentInput {
	if s == nil || doc == nil {
		return nil
	}

	resolvedUserID := strings.TrimSpace(userID)
	if resolvedUserID == "" {
		resolvedUserID = strings.TrimSpace(doc.UpdatedUID)
	}

	request := &documentdomain.SyncDocumentInput{
		OrganizationCode:  doc.OrganizationCode,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		Code:              doc.Code,
		Mode:              documentdomain.SyncModeResync,
		Async:             true,
		BusinessParams:    texthelper.BuildCreateBusinessParams(doc.OrganizationCode, resolvedUserID, doc.KnowledgeBaseCode),
	}
	if !documentdomain.ShouldResolveThirdPlatformDocument(doc) {
		return request
	}

	override, found, err := s.resolveDocumentUpdateSourceOverride(ctx, doc, request.BusinessParams)
	if err != nil && s.logger != nil {
		s.logger.KnowledgeWarnContext(
			ctx,
			"Resolve latest third-platform source override for document update failed, fallback to single-document resync",
			"organization_code", doc.OrganizationCode,
			"knowledge_base_code", doc.KnowledgeBaseCode,
			"document_code", doc.Code,
			"third_platform_type", doc.ThirdPlatformType,
			"third_file_id", doc.ThirdFileID,
			"error", err,
		)
	}
	if found {
		request.SourceOverride = override
		return request
	}

	request.SingleDocumentThirdPlatformResync = true
	return request
}

func (s *DocumentAppService) resolveDocumentUpdateSourceOverride(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
) (*documentdomain.SourceOverride, bool, error) {
	if s == nil || doc == nil {
		return nil, false, nil
	}

	if override, found, err := s.resolveDocumentUpdateSourceOverrideWithSnapshot(ctx, doc, businessParams); found || err != nil {
		return override, found, err
	}
	return nil, false, nil
}

func (s *DocumentAppService) resolveDocumentUpdateSourceOverrideWithSnapshot(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	businessParams *ctxmeta.BusinessParams,
) (*documentdomain.SourceOverride, bool, error) {
	if s == nil || doc == nil {
		return nil, false, nil
	}

	input := documentdomain.NormalizeThirdFileRevectorizeInput(&documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  doc.OrganizationCode,
		UserID:            businessParamsUserID(businessParams),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
	})
	if input == nil || input.OrganizationCode == "" || input.ThirdPlatformType == "" || input.ThirdFileID == "" {
		return nil, false, nil
	}

	if err := s.ensureThirdPlatformProvider(input.ThirdPlatformType); err != nil {
		return nil, false, err
	}
	seed, err := documentdomain.BuildThirdFileRevectorizeSeed(input, []*docentity.KnowledgeBaseDocument{doc})
	if err != nil {
		return nil, false, fmt.Errorf("build third-platform revectorize seed: %w", err)
	}
	snapshot, err := s.resolveThirdPlatformSourceSnapshot(ctx, input, seed)
	if err != nil {
		return nil, false, err
	}
	override := sourceSnapshotToOverride(snapshot)
	if override == nil {
		return nil, false, nil
	}
	return override, true, nil
}

func sourceSnapshotToOverride(snapshot *documentdomain.ResolvedSourceSnapshot) *documentdomain.SourceOverride {
	if snapshot == nil {
		return nil
	}
	if strings.TrimSpace(snapshot.Content) == "" && snapshot.ParsedDocument == nil {
		return nil
	}
	return &documentdomain.SourceOverride{
		Content:      snapshot.Content,
		DocType:      snapshot.DocType,
		DocumentFile: documentdomain.CloneDocumentFilePayload(snapshot.DocumentFile),
		// override 后面会继续参与重同步流程，不能和 snapshot 共用同一份 ParsedDocument，
		// 否则下游改了 override，回头就会把 snapshot 一起改脏。
		ParsedDocument:     parseddocument.CloneParsedDocument(snapshot.ParsedDocument),
		Source:             snapshot.Source,
		ContentHash:        snapshot.ContentHash,
		FetchedAtUnixMilli: snapshot.FetchedAtUnixMilli,
	}
}

func shouldPrepareSingleDocumentThirdPlatformResync(input *documentdomain.SyncDocumentInput) bool {
	if input == nil {
		return false
	}
	if input.SingleDocumentThirdPlatformResync {
		return true
	}
	return documentdomain.RevectorizeSourcePrefersSingleDocumentThirdPlatformResync(input.RevectorizeSource)
}

func (s *DocumentAppService) prepareSingleDocumentThirdPlatformResync(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	input *documentdomain.SyncDocumentInput,
) (bool, error) {
	if s == nil || doc == nil || input == nil || !shouldPrepareSingleDocumentThirdPlatformResync(input) || input.SourceOverride != nil {
		return false, nil
	}

	override, found, err := s.resolveDocumentUpdateSourceOverride(ctx, doc, input.BusinessParams)
	if err != nil {
		return s.handleSingleDocumentThirdPlatformResyncSourceResolveError(ctx, doc, input, err)
	}

	if found {
		input.SourceOverride = override
	}
	return false, nil
}

func (s *DocumentAppService) handleSingleDocumentThirdPlatformResyncSourceResolveError(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	input *documentdomain.SyncDocumentInput,
	err error,
) (bool, error) {
	if isDocumentReadUserMissingError(err) {
		s.logSkippedSingleDocumentThirdPlatformResync(ctx, doc, err)
		return true, nil
	}
	if shouldDestroySingleDocumentThirdPlatformResyncOnUnsupportedFileType(input, err) {
		// third-file 变更通知已经退化成“每文档一条 document_sync MQ”。
		// producer 不再提前解析 latest source 并统一删文档，因此要把“latest 文件已不支持时删除映射文档”
		// 的旧语义迁到单文档 consumer 里完成，才能在改成按文档 MQ 后保持业务结果不变。
		if destroyErr := s.destroyDocument(ctx, doc); destroyErr != nil {
			return false, destroyErr
		}
		return true, nil
	}
	s.logFallbackSingleDocumentThirdPlatformResyncSourceResolveError(ctx, doc, err)
	return false, nil
}

func shouldDestroySingleDocumentThirdPlatformResyncOnUnsupportedFileType(
	input *documentdomain.SyncDocumentInput,
	err error,
) bool {
	if input == nil {
		return false
	}
	return errors.Is(err, documentdomain.ErrUnsupportedKnowledgeBaseFileType) &&
		documentdomain.NormalizeRevectorizeSource(input.RevectorizeSource) == documentdomain.RevectorizeSourceThirdFileBroadcast
}

func (s *DocumentAppService) logFallbackSingleDocumentThirdPlatformResyncSourceResolveError(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	err error,
) {
	if s == nil || s.logger == nil || doc == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Resolve latest third-platform source override during single-document resync failed, fallback to direct document resolve",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"third_platform_type", doc.ThirdPlatformType,
		"third_file_id", doc.ThirdFileID,
		"error", err,
	)
}

func (s *DocumentAppService) logSkippedSingleDocumentThirdPlatformResync(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	err error,
) {
	if s == nil || s.logger == nil || doc == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Skip single-document third-platform resync because read user is missing",
		"organization_code", doc.OrganizationCode,
		"knowledge_base_code", doc.KnowledgeBaseCode,
		"document_code", doc.Code,
		"third_platform_type", doc.ThirdPlatformType,
		"third_file_id", doc.ThirdFileID,
		"created_uid", doc.CreatedUID,
		"updated_uid", doc.UpdatedUID,
		"source_binding_id", doc.SourceBindingID,
		"skip_reason", "document_read_user_missing",
		"error", err,
	)
}
