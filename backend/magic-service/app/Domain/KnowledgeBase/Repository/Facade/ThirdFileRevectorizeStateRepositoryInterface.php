<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Facade;

use DateTimeInterface;

interface ThirdFileRevectorizeStateRepositoryInterface
{
    public function recordNotification(
        string $organizationCode,
        string $thirdPlatformType,
        string $thirdFileId,
        array $payload,
        DateTimeInterface $now,
        int $cooldownMinutes,
    ): bool;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function claimDuePayloads(DateTimeInterface $now, int $limit): array;
}
