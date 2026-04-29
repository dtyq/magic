package document

import (
	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/domain/knowledge/shared"
)

// EffectiveConfigState 表示文档实际生效的解析/分段配置快照。
type EffectiveConfigState struct {
	ParseOptions   ParseOptions
	FragmentConfig *shared.FragmentConfig
}

// CaptureEffectiveConfigState 捕获文档当前实际生效的配置状态。
func CaptureEffectiveConfigState(doc *docentity.KnowledgeBaseDocument) EffectiveConfigState {
	if doc == nil {
		return EffectiveConfigState{
			ParseOptions: DefaultParseOptions(),
		}
	}
	return EffectiveConfigState{
		ParseOptions:   ResolveDocumentParseOptions(doc),
		FragmentConfig: shared.NormalizeFragmentConfig(doc.FragmentConfig),
	}
}

// ShouldResyncAfterConfigUpdate 判断更新后的实际配置是否需要触发重同步。
func ShouldResyncAfterConfigUpdate(before EffectiveConfigState, after *docentity.KnowledgeBaseDocument) bool {
	afterState := CaptureEffectiveConfigState(after)
	return before.ParseOptions != afterState.ParseOptions ||
		!shared.FragmentConfigEqual(before.FragmentConfig, afterState.FragmentConfig)
}

// ShouldRecoveryResyncForNonSyncedDocument 判断非成功文档是否需要走恢复性重同步。
func ShouldRecoveryResyncForNonSyncedDocument(doc *docentity.KnowledgeBaseDocument) bool {
	return doc != nil && doc.SyncStatus != shared.SyncStatusSynced
}
