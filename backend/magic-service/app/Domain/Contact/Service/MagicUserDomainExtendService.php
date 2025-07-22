<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Contact\DTO\UserUpdateDTO;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Service\Facade\MagicUserDomainExtendInterface;
use App\Infrastructure\Core\Traits\DataIsolationTrait;

class MagicUserDomainExtendService implements MagicUserDomainExtendInterface
{
    use DataIsolationTrait;

    public function __construct(
        protected MagicUserRepositoryInterface $userRepository,
    ) {
    }

    /**
     * 是否允许更新用户信息.
     * 返回允许修改的字段.
     */
    public function getUserUpdatePermission(DataIsolation $dataIsolation): array
    {
        $userId = $dataIsolation->getCurrentUserId();
        if (empty($userId)) {
            return [];
        }
        return ['avatar_url', 'nickname'];
    }

    /**
     * 更新用户信息.
     */
    public function updateUserInfo(DataIsolation $dataIsolation, UserUpdateDTO $userUpdateDTO): int
    {
        $permission = $this->getUserUpdatePermission($dataIsolation);

        $userId = $dataIsolation->getCurrentUserId();
        $updateFilter = [];

        // 处理头像URL
        if (in_array('avatar_url', $permission) && $userUpdateDTO->getAvatarUrl() !== null) {
            $updateFilter['avatar_url'] = $userUpdateDTO->getAvatarUrl();
        }

        // 处理昵称
        if (in_array('nickname', $permission) && $userUpdateDTO->getNickname() !== null) {
            $updateFilter['nickname'] = $userUpdateDTO->getNickname();
        }

        return $this->userRepository->updateDataById($userId, $updateFilter);
    }
}
