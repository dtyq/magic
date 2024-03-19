<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Entity\MagicFriendEntity;
use App\Domain\Chat\Repository\Facade\MagicFriendRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicFriendModel;
use App\Domain\Contact\DTO\FriendQueryDTO;

class MagicFriendRepository implements MagicFriendRepositoryInterface
{
    public function __construct(
        protected MagicFriendModel $friend
    ) {
    }

    public function insertFriend(array $friendEntity): void
    {
        $this->friend::query()->create($friendEntity);
    }

    public function isFriend(string $userId, string $friendId): bool
    {
        $friend = $this->friend::query()->where('user_id', $userId)->where('friend_id', $friendId)->first();
        return $friend !== null;
    }

    /**
     * @return MagicFriendEntity[]
     */
    public function getFriendList(FriendQueryDTO $friendQueryDTO, string $userId): array
    {
        $friendType = $friendQueryDTO->getFriendType()->value;
        $query = $this->friend::query()->where('user_id', $userId);
        if (in_array($friendType, [0, 1])) {
            $query->where('friend_type', $friendType);
        }
        if (! empty($friendQueryDTO->getUserIds())) {
            $query->whereIn('friend_id', $friendQueryDTO->getUserIds());
        }
        $friends = $query->get()->toArray();
        return array_map(function ($friend) {
            return new MagicFriendEntity($friend);
        }, $friends);
    }
}
