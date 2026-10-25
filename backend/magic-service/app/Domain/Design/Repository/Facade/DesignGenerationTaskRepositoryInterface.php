<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Repository\Facade;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;

interface DesignGenerationTaskRepositoryInterface
{
    public function create(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void;

    public function update(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void;

    public function delete(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void;

    public function findByProjectAndGenerationId(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $generationId
    ): ?DesignGenerationTaskEntity;

    /**
     * 按产物的工作区相对路径反查任务，用于只拿得到路径、拿不到 video_id 的调用方。
     */
    public function findByProjectAndOutputFilePath(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        DesignGenerationAssetType $assetType,
        string $relativeFilePath
    ): ?DesignGenerationTaskEntity;

    /**
     * @return DesignGenerationTaskEntity[]
     */
    public function findProcessingTasksAfterId(int $cursorId, int $limit): array;
}
