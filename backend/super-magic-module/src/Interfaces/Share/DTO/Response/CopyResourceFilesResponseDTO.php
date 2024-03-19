<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;

/**
 * 复制资源文件响应DTO.
 */
class CopyResourceFilesResponseDTO
{
    /**
     * 复制记录ID（用于查询复制进度）.
     */
    public string $copyRecordId = '';

    /**
     * 新项目ID.
     */
    public string $newProjectId = '';

    /**
     * 复制状态
     */
    public string $status = '';

    /**
     * 进度百分比 (0-100).
     */
    public int $progress = 0;

    /**
     * 已处理文件数.
     */
    public int $processedFiles = 0;

    /**
     * 总文件数.
     */
    public int $totalFiles = 0;

    public static function fromEntity(ProjectForkEntity $entity): self
    {
        $dto = new self();
        $dto->copyRecordId = (string) $entity->getId();
        $dto->newProjectId = (string) $entity->getForkProjectId();
        $dto->status = $entity->getStatus()->value;
        $dto->progress = $entity->getProgress();
        $dto->processedFiles = $entity->getProcessedFiles();
        $dto->totalFiles = $entity->getTotalFiles();

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'copy_record_id' => $this->copyRecordId,
            'new_project_id' => $this->newProjectId,
            'status' => $this->status,
            'progress' => $this->progress,
            'processed_files' => $this->processedFiles,
            'total_files' => $this->totalFiles,
        ];
    }
}
