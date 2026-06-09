// Package service 实现知识库外部数据接入的领域规则。
package service

import (
	"fmt"
	"time"

	ingestionentity "magic/internal/domain/knowledge/ingestion/entity"
)

// DefaultMaxCleanContentBytes 是 cleaned markdown 持久化到 MySQL 的默认正文上限。
const DefaultMaxCleanContentBytes = ingestionentity.DefaultMaxCleanContentBytes

// DomainService 收敛外部接入的纯领域规则。
type DomainService struct {
	maxCleanContentBytes uint64
	now                  func() time.Time
}

// NewDomainService 创建 ingestion 领域服务。
func NewDomainService(maxCleanContentBytes uint64, now func() time.Time) *DomainService {
	if maxCleanContentBytes == 0 {
		maxCleanContentBytes = ingestionentity.DefaultMaxCleanContentBytes
	}
	if now == nil {
		now = time.Now
	}
	return &DomainService{maxCleanContentBytes: maxCleanContentBytes, now: now}
}

// PrepareCleanedDocument 校验并补齐 cleaned document。
func (s *DomainService) PrepareCleanedDocument(input ingestionentity.CleanedDocument) (ingestionentity.CleanedDocument, error) {
	if s == nil {
		s = NewDomainService(0, nil)
	}
	document, err := ingestionentity.PrepareCleanedDocument(input, s.maxCleanContentBytes, s.now)
	if err != nil {
		return ingestionentity.CleanedDocument{}, fmt.Errorf("prepare cleaned document: %w", err)
	}
	return document, nil
}
