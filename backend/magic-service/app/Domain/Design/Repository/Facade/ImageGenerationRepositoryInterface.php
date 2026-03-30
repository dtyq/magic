<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Repository\Facade;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;

/**
 * 图片生成任务仓储接口.
 */
interface ImageGenerationRepositoryInterface
{
    /**
     * 创建生图任务
     */
    public function create(DesignDataIsolation $dataIsolation, ImageGenerationEntity $entity): void;

    /**
     * 根据 ID 查询任务
     */
    public function findById(DesignDataIsolation $dataIsolation, int $id): ?ImageGenerationEntity;

    /**
     * 根据 project_id 和 image_id 查询任务
     */
    public function findByProjectAndImageId(DesignDataIsolation $dataIsolation, int $projectId, string $imageId): ?ImageGenerationEntity;

    /**
     * 更新任务状态
     */
    public function updateStatus(DesignDataIsolation $dataIsolation, int $id, string $status, ?string $errorMessage = null): void;

    public function completed(DesignDataIsolation $dataIsolation, int $id, string $fileName): void;
}
