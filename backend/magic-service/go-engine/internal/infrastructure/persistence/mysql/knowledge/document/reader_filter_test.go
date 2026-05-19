package documentrepo_test

import (
	"testing"

	docentity "magic/internal/domain/knowledge/document/entity"
	docrepo "magic/internal/domain/knowledge/document/repository"
	documentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
)

func TestBuildDocumentListFilterParamsDefaultIncludesEnterpriseAndFormatDocTypes(t *testing.T) {
	t.Parallel()

	params, err := documentrepo.BuildDocumentListFilterParamsForTest(&docrepo.DocumentQuery{})
	if err != nil {
		t.Fatalf("buildDocumentListFilterParams returned error: %v", err)
	}

	requiredTypes := map[uint32]struct{}{
		uint32(docentity.DocTypeText):          {},
		uint32(docentity.DocTypeMarkdown):      {},
		uint32(docentity.DocTypePDF):           {},
		uint32(docentity.DocTypeXLSX):          {},
		uint32(docentity.DocTypeDOCX):          {},
		uint32(docentity.DocTypeCSV):           {},
		uint32(docentity.DocTypeCloudDocument): {},
		uint32(docentity.DocTypeMultiTable):    {},
	}

	got := make(map[uint32]struct{}, len(params.DocTypeValues))
	for _, value := range params.DocTypeValues {
		got[value] = struct{}{}
	}

	for value := range requiredTypes {
		if _, ok := got[value]; !ok {
			t.Fatalf("expected default doc_type filter to include %d, got %#v", value, params.DocTypeValues)
		}
	}
}

func TestBuildDocumentListFilterParamsExplicitDocTypeOverridesDefaultSet(t *testing.T) {
	t.Parallel()

	docType := int(docentity.DocTypeCloudDocument)
	params, err := documentrepo.BuildDocumentListFilterParamsForTest(&docrepo.DocumentQuery{DocType: &docType})
	if err != nil {
		t.Fatalf("buildDocumentListFilterParams returned error: %v", err)
	}
	if len(params.DocTypeValues) != 1 || params.DocTypeValues[0] != uint32(docentity.DocTypeCloudDocument) {
		t.Fatalf("expected explicit doc_type filter to win, got %#v", params.DocTypeValues)
	}
}
