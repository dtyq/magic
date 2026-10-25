<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

use DateTimeImmutable;

final readonly class UserInfoDTO
{
    /**
     * @param list<array{id: string, name: string, path: string}> $departments
     */
    public function __construct(
        public DateTimeImmutable $capturedAt,
        public string $id,
        public string $magicId,
        public string $nickname,
        public string $realName,
        public string $avatarUrl,
        public string $workNumber,
        public string $position,
        public string $email,
        public string $phone,
        public array $departments,
        public string $organizationCode,
        public string $organizationName,
        public UserAccountDTO $account,
        public string $thirdPlatformId = '',
    ) {
    }

    public function toArray(): array
    {
        return [
            'captured_at' => $this->capturedAt->format(DATE_ATOM),
            'user' => [
                'id' => $this->id,
                'magic_id' => $this->magicId,
                'third_platform_id' => $this->thirdPlatformId,
                'nickname' => $this->nickname,
                'real_name' => $this->realName,
                'avatar_url' => $this->avatarUrl,
                'work_number' => $this->workNumber,
                'position' => $this->position,
                'email' => $this->email,
                'phone' => $this->phone,
                'departments' => $this->departments,
            ],
            'organization' => ['code' => $this->organizationCode, 'name' => $this->organizationName],
            'subscription' => $this->account->subscription->toArray(),
            'points' => $this->account->points->toArray(),
        ];
    }
}
