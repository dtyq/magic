// Package repository 定义知识库重建仓储接口。
package repository

import "context"

// VectorDualWriteState 描述向量重建期间的双写路由状态。
type VectorDualWriteState struct {
	RunID            string `json:"run_id"`
	Enabled          bool   `json:"enabled"`
	Mode             string `json:"mode"`
	ActiveCollection string `json:"active_collection"`
	ShadowCollection string `json:"shadow_collection"`
	ActiveModel      string `json:"active_model"`
	TargetModel      string `json:"target_model"`
}

// VectorRebuildFailureEvent 记录重建期间影子写失败事件。
type VectorRebuildFailureEvent struct {
	RunID             string `json:"run_id"`
	Operation         string `json:"operation"`
	OrganizationCode  string `json:"organization_code"`
	KnowledgeBaseCode string `json:"knowledge_base_code"`
	DocumentCode      string `json:"document_code"`
	UserID            string `json:"user_id"`
	Error             string `json:"error"`
}

// VectorRebuildCoordinator 提供向量重建运行态协调能力。
// 该接口主要用于在线读写路径查询双写状态，并在影子写失败时记录补偿事件。
type VectorRebuildCoordinator interface {
	GetDualWriteState(ctx context.Context) (*VectorDualWriteState, error)
	EnqueueFailure(ctx context.Context, event *VectorRebuildFailureEvent) error
}

// VectorRebuildRunStateReader 提供重建任务运行态读取能力。
type VectorRebuildRunStateReader interface {
	GetCurrentRun(ctx context.Context) (string, error)
}
