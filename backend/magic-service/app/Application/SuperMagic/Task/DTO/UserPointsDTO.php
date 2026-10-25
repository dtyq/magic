<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

use DateTimeImmutable;
use InvalidArgumentException;

final readonly class UserPointsDTO
{
    public function __construct(
        public UserAccountDataStatus $status,
        public ?DateTimeImmutable $capturedAt = null,
        public null|float|int $available = null,
    ) {
        // 查询失败不能用 0 代替；真实的 0 和负余额均是有效业务结果。
        if ($status === UserAccountDataStatus::None
            || ($status === UserAccountDataStatus::Available
                ? $capturedAt === null || $available === null || ! is_finite((float) $available)
                : $capturedAt !== null || $available !== null)) {
            throw new InvalidArgumentException('Points values and query time must match their status.');
        }
    }

    /**
     * @return array{status: string, scope: string, captured_at?: string, available?: float|int}
     */
    public function toArray(): array
    {
        return array_filter([
            'status' => $this->status->value,
            'scope' => 'current_user_visible',
            'captured_at' => $this->capturedAt?->format(DATE_ATOM),
            'available' => $this->available,
        ], static fn ($value): bool => $value !== null);
    }
}
