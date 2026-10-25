<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository;

use App\Domain\ModelGateway\Entity\ImageGenerationTaskEntity;

interface ImageGenerationTaskRepositoryInterface
{
    public function getById(string $id): ?ImageGenerationTaskEntity;

    public function save(ImageGenerationTaskEntity $entity): void;

    /**
     * 批量把创建时间不晚于 $createdBefore 且仍在执行中的任务置为失败。
     *
     * @param string $createdBefore 截止时间，格式 Y-m-d H:i:s，按创建时间升序优先处理
     * @param int $limit 单次最多更新的行数，避免一次锁住过多数据
     * @return int 实际更新的行数
     */
    public function markTimedOutBatch(
        string $createdBefore,
        string $errorCode,
        string $errorMessage,
        int $limit
    ): int;
}
