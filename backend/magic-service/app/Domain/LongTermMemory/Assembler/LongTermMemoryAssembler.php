<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Assembler;

use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;

/**
 * 长期记忆组装器.
 */
class LongTermMemoryAssembler
{
    /**
     * 使用 UpdateMemoryDTO 更新记忆实体.
     */
    public static function updateEntityFromDTO(LongTermMemoryEntity $entity, UpdateMemoryDTO $dto): void
    {
        if ($dto->content !== null) {
            $entity->setContent($dto->content);
        }
        if ($dto->pendingContent !== null) {
            $entity->setPendingContent($dto->pendingContent);
        }
        if ($dto->explanation !== null) {
            $entity->setExplanation($dto->explanation);
        }
        if ($dto->originText !== null) {
            $entity->setOriginText($dto->originText);
        }
        if ($dto->status !== null) {
            $entity->setStatus($dto->status);
        }
        if ($dto->confidence !== null) {
            $entity->setConfidence($dto->confidence);
        }
        if ($dto->importance !== null) {
            $entity->setImportance($dto->importance);
        }
        if ($dto->tags !== null) {
            $entity->setTags($dto->tags);
        }
        if ($dto->metadata !== null) {
            $entity->setMetadata($dto->metadata);
        }
        // enabled 放在最后设置，确保 status 已经正确设置
        if ($dto->enabled !== null) {
            $entity->setEnabled($dto->enabled);
        }
        if ($dto->expiresAt !== null) {
            $entity->setExpiresAt($dto->expiresAt);
        }
    }
}
