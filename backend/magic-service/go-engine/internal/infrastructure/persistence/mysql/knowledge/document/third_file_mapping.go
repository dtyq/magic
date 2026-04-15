package documentrepo

import (
	"context"
	"errors"
	"fmt"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

// FindByKnowledgeBaseAndThirdFile 按知识库和第三方文件标识查询文档。
func (repo *DocumentRepository) FindByKnowledgeBaseAndThirdFile(
	ctx context.Context,
	knowledgeBaseCode string,
	thirdPlatformType string,
	thirdFileID string,
) (*documentdomain.KnowledgeBaseDocument, error) {
	doc, err := repo.findOne(
		ctx,
		documentSelectSQL+" WHERE d.deleted_at IS NULL AND d.knowledge_base_code = ? AND d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC LIMIT 1",
		knowledgeBaseCode,
		thirdPlatformType,
		thirdFileID,
	)
	if err == nil || !errors.Is(err, shared.ErrDocumentNotFound) {
		return doc, err
	}
	organizationCode, err := repo.findOrganizationCodeByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, err
	}
	return repo.findOne(
		ctx,
		documentSelectSQL+" WHERE d.deleted_at IS NULL AND d.knowledge_base_code = ? AND si.organization_code = ? AND si.provider = ? AND si.item_ref = ? ORDER BY d.id DESC LIMIT 1",
		knowledgeBaseCode,
		organizationCode,
		thirdPlatformType,
		thirdFileID,
	)
}

// ListByThirdFileInOrg 列出组织内关联到指定第三方文件的文档。
func (repo *DocumentRepository) ListByThirdFileInOrg(
	ctx context.Context,
	organizationCode string,
	thirdPlatformType string,
	thirdFileID string,
) ([]*documentdomain.KnowledgeBaseDocument, error) {
	directDocs, err := repo.listByQuery(
		ctx,
		documentSelectSQL+" WHERE d.deleted_at IS NULL AND d.organization_code = ? AND d.third_platform_type = ? AND d.third_file_id = ? ORDER BY d.id DESC",
		organizationCode,
		thirdPlatformType,
		thirdFileID,
	)
	if err != nil {
		return nil, fmt.Errorf("list documents by third file in org: %w", err)
	}

	fallbackDocs, err := repo.listByQuery(
		ctx,
		documentSelectSQL+" WHERE d.deleted_at IS NULL AND d.organization_code = ? AND si.organization_code = ? AND si.provider = ? AND si.item_ref = ? ORDER BY d.id DESC",
		organizationCode,
		organizationCode,
		thirdPlatformType,
		thirdFileID,
	)
	if err != nil {
		return nil, fmt.Errorf("list documents by third file in org via source item: %w", err)
	}
	return mergeThirdFileDocumentLists(directDocs, fallbackDocs), nil
}

func mergeThirdFileDocumentLists(
	directDocs []*documentdomain.KnowledgeBaseDocument,
	fallbackDocs []*documentdomain.KnowledgeBaseDocument,
) []*documentdomain.KnowledgeBaseDocument {
	merged := make([]*documentdomain.KnowledgeBaseDocument, 0, len(directDocs)+len(fallbackDocs))
	seen := make(map[string]struct{}, len(directDocs)+len(fallbackDocs))

	appendUnique := func(docs []*documentdomain.KnowledgeBaseDocument) {
		for _, doc := range docs {
			if doc == nil {
				continue
			}
			key := fmt.Sprintf("%d:%s:%s", doc.ID, doc.KnowledgeBaseCode, doc.Code)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, doc)
		}
	}

	appendUnique(directDocs)
	appendUnique(fallbackDocs)
	return merged
}
