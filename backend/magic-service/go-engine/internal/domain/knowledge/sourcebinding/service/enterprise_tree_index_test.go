package sourcebinding_test

import (
	"testing"

	sourcebindingservice "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/thirdplatform"
)

const (
	testEnterpriseTreeIndexKnowledgeBaseRef = "KB-1"
	testEnterpriseTreeIndexFolder1Ref       = "folder-1"
	testEnterpriseTreeIndexFolder2Ref       = "folder-2"
)

func TestBuildEnterpriseTreeIndexBuildsDirectChildrenByPath(t *testing.T) {
	t.Parallel()

	index, err := sourcebindingservice.BuildEnterpriseTreeIndex(enterpriseTreeIndexSampleNodes())
	if err != nil {
		t.Fatalf("build enterprise tree index: %v", err)
	}

	rootChildren := index.DirectChildren(testEnterpriseTreeIndexKnowledgeBaseRef)
	if len(rootChildren) != 2 || rootChildren[0].ThirdFileID != "file-empty" || rootChildren[1].ThirdFileID != testEnterpriseTreeIndexFolder1Ref {
		t.Fatalf("unexpected root direct children: %#v", rootChildren)
	}

	folder1Children := index.DirectChildren(testEnterpriseTreeIndexFolder1Ref)
	if len(folder1Children) != 2 || folder1Children[0].ThirdFileID != "file-hello" || folder1Children[1].ThirdFileID != testEnterpriseTreeIndexFolder2Ref {
		t.Fatalf("unexpected folder-1 direct children: %#v", folder1Children)
	}

	folder2Children := index.DirectChildren(testEnterpriseTreeIndexFolder2Ref)
	if len(folder2Children) != 1 || folder2Children[0].ThirdFileID != "file-finance" {
		t.Fatalf("unexpected folder-2 direct children: %#v", folder2Children)
	}
}

func TestBuildEnterpriseTreeIndexRejectsInvalidPath(t *testing.T) {
	t.Parallel()

	_, err := sourcebindingservice.BuildEnterpriseTreeIndex([]thirdplatform.TreeNode{{
		KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
		ThirdFileID:     "file-invalid",
		Name:            "坏数据",
		FileType:        "3",
	}})
	if err == nil {
		t.Fatal("expected invalid path error")
	}
}

func TestBuildEnterpriseTreeIndexRejectsPathLeafMismatch(t *testing.T) {
	t.Parallel()

	_, err := sourcebindingservice.BuildEnterpriseTreeIndex([]thirdplatform.TreeNode{{
		KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
		ThirdFileID:     "file-invalid",
		Name:            "坏数据",
		FileType:        "3",
		Path: []thirdplatform.PathNode{
			{ID: "0", Name: "企业知识库空间", Type: "space"},
			{ID: testEnterpriseTreeIndexKnowledgeBaseRef, Name: "知识库", Type: "9"},
			{ID: "another-file", Name: "坏数据", Type: "3"},
		},
	}})
	if err == nil {
		t.Fatal("expected path leaf mismatch error")
	}
}

func enterpriseTreeIndexSampleNodes() []thirdplatform.TreeNode {
	return []thirdplatform.TreeNode{
		{
			KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
			ThirdFileID:     "file-empty",
			ParentID:        "wrong-parent",
			Name:            "空数据",
			FileType:        "3",
			Path: []thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseTreeIndexKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: "file-empty", Name: "空数据", Type: "3"},
			},
		},
		{
			KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
			ThirdFileID:     testEnterpriseTreeIndexFolder1Ref,
			ParentID:        "broken-parent",
			Name:            "目录1",
			FileType:        "0",
			IsDirectory:     true,
			Path: []thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseTreeIndexKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseTreeIndexFolder1Ref, Name: "目录1", Type: "0"},
			},
		},
		{
			KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
			ThirdFileID:     "file-hello",
			ParentID:        "wrong-parent",
			Name:            "你好",
			FileType:        "16",
			Path: []thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseTreeIndexKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseTreeIndexFolder1Ref, Name: "目录1", Type: "0"},
				{ID: "file-hello", Name: "你好", Type: "16"},
			},
		},
		{
			KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
			ThirdFileID:     testEnterpriseTreeIndexFolder2Ref,
			ParentID:        "wrong-parent",
			Name:            "目录2",
			FileType:        "0",
			IsDirectory:     true,
			Path: []thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseTreeIndexKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseTreeIndexFolder1Ref, Name: "目录1", Type: "0"},
				{ID: testEnterpriseTreeIndexFolder2Ref, Name: "目录2", Type: "0"},
			},
		},
		{
			KnowledgeBaseID: testEnterpriseTreeIndexKnowledgeBaseRef,
			ThirdFileID:     "file-finance",
			ParentID:        "wrong-parent",
			Name:            "财务",
			FileType:        "3",
			Path: []thirdplatform.PathNode{
				{ID: "0", Name: "企业知识库空间", Type: "space"},
				{ID: testEnterpriseTreeIndexKnowledgeBaseRef, Name: "知识库", Type: "9"},
				{ID: testEnterpriseTreeIndexFolder1Ref, Name: "目录1", Type: "0"},
				{ID: testEnterpriseTreeIndexFolder2Ref, Name: "目录2", Type: "0"},
				{ID: "file-finance", Name: "财务", Type: "3"},
			},
		},
	}
}
