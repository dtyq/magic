<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

use DateTimeImmutable;
use InvalidArgumentException;

final readonly class UserSubscriptionDTO
{
    public function __construct(
        public UserAccountDataStatus $status,
        public ?DateTimeImmutable $capturedAt = null,
        public ?string $id = null,
        public ?string $name = null,
        public ?string $planType = null,
        public ?DateTimeImmutable $startsAt = null,
        public ?DateTimeImmutable $endsAt = null,
    ) {
        $queried = in_array($status, [UserAccountDataStatus::Available, UserAccountDataStatus::None], true);
        if ($queried !== ($capturedAt !== null)) {
            throw new InvalidArgumentException('Subscription query time must match its status.');
        }
        if ($status === UserAccountDataStatus::Available && ! $id && ! $name) {
            throw new InvalidArgumentException('An available subscription requires an ID or name.');
        }
        if ($status !== UserAccountDataStatus::Available && array_filter([$id, $name, $planType, $startsAt, $endsAt])) {
            throw new InvalidArgumentException('Unavailable subscriptions cannot contain plan details.');
        }
    }

    /**
     * @return array{status: string, scope: string, captured_at?: string, id?: string, name?: string, plan_type?: string, starts_at?: string, ends_at?: string}
     */
    public function toArray(): array
    {
        return array_filter([
            'status' => $this->status->value,
            'scope' => 'organization',
            'captured_at' => $this->capturedAt?->format(DATE_ATOM),
            'id' => $this->id,
            'name' => $this->name,
            'plan_type' => $this->planType,
            'starts_at' => $this->startsAt?->format(DATE_ATOM),
            'ends_at' => $this->endsAt?->format(DATE_ATOM),
        ], static fn ($value): bool => $value !== null);
    }
}
