<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Service;

use App\Domain\KnowledgeBase\Repository\Facade\ThirdFileRevectorizeStateRepositoryInterface;
use Carbon\Carbon;

readonly class ThirdFileRevectorizeCooldownDomainService
{
    private const int COOLDOWN_MINUTES = 30;

    public function __construct(
        private ThirdFileRevectorizeStateRepositoryInterface $repository,
    ) {
    }

    public function recordNotification(
        string $organizationCode,
        string $thirdPlatformType,
        string $thirdFileId,
        array $payload,
    ): bool {
        return $this->repository->recordNotification(
            $organizationCode,
            $thirdPlatformType,
            $thirdFileId,
            $payload,
            Carbon::now(),
            self::COOLDOWN_MINUTES,
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function claimDuePayloads(int $limit): array
    {
        return $this->repository->claimDuePayloads(Carbon::now(), $limit);
    }
}
