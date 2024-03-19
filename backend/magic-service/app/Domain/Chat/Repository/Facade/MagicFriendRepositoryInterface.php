<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\Entity\MagicFriendEntity;
use App\Domain\Contact\DTO\FriendQueryDTO;

interface MagicFriendRepositoryInterface
{
    public function insertFriend(array $friendEntity): void;

    public function isFriend(string $userId, string $friendId): bool;

    /**
     * @return MagicFriendEntity[]
     */
    public function getFriendList(FriendQueryDTO $friendQueryDTO, string $userId): array;
}
