package knowledgebase

import (
	"magic/internal/domain/knowledge/shared"
)

// ExpectedPayloadIndexSpecs 返回当前知识库共享集合需要保证存在的 payload 索引声明。
func ExpectedPayloadIndexSpecs() []shared.PayloadIndexSpec {
	return []shared.PayloadIndexSpec{
		{FieldName: "knowledge_code", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "organization_code", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "document_code", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "section_path", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "section_title", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "business_id", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "metadata.tags", Kind: shared.PayloadIndexKindKeyword},
		{FieldName: "document_type", Kind: shared.PayloadIndexKindInteger},
		{FieldName: "metadata.section_level", Kind: shared.PayloadIndexKindInteger},
		{FieldName: "metadata.created_at_ts", Kind: shared.PayloadIndexKindInteger},
	}
}
