package docapp

import (
	"context"
	"fmt"
	"strings"

	texthelper "magic/internal/application/knowledge/helper/text"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/ctxmeta"
)

func (s *DocumentAppService) scheduleDocumentUpdateResync(
	ctx context.Context,
	doc *documentdomain.KnowledgeBaseDocument,
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
	doc *documentdomain.KnowledgeBaseDocument,
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
		s.logger.WarnContext(
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
	doc *documentdomain.KnowledgeBaseDocument,
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
	doc *documentdomain.KnowledgeBaseDocument,
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
	seed, err := documentdomain.BuildThirdFileRevectorizeSeed(input, []*documentdomain.KnowledgeBaseDocument{doc})
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
	return &documentdomain.SourceOverride{
		Content:            snapshot.Content,
		DocType:            snapshot.DocType,
		DocumentFile:       documentdomain.CloneDocumentFilePayload(snapshot.DocumentFile),
		Source:             snapshot.Source,
		ContentHash:        snapshot.ContentHash,
		FetchedAtUnixMilli: snapshot.FetchedAtUnixMilli,
	}
}

func (s *DocumentAppService) prepareSingleDocumentThirdPlatformResync(
	ctx context.Context,
	doc *documentdomain.KnowledgeBaseDocument,
	input *documentdomain.SyncDocumentInput,
) {
	if s == nil || doc == nil || input == nil || !input.SingleDocumentThirdPlatformResync || input.SourceOverride != nil {
		return
	}

	override, found, err := s.resolveDocumentUpdateSourceOverride(ctx, doc, input.BusinessParams)
	if err != nil {
		if s.logger != nil {
			s.logger.WarnContext(
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
		return
	}

	if found {
		input.SourceOverride = override
	}
}
