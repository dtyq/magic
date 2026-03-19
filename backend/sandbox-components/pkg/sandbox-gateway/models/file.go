package models

// FileCopyItem represents a single file copy operation
type FileCopyItem struct {
	SourceOSSPath string `json:"source_oss_path" binding:"required"`
	TargetOSSPath string `json:"target_oss_path" binding:"required"`
}

// FileCopyRequest represents the request for file copy operation
type FileCopyRequest struct {
	Files []FileCopyItem `json:"files" binding:"required,min=1"`
}
