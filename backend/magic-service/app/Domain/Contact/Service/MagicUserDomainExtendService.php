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
        return ['avatar_url', 'nickname', 'profession', 'channel', 'timezone', 'preferences'];
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
        if (in_array('avatar_url', $permission, true) && $userUpdateDTO->isFieldPresent('avatar_url')) {
            $updateFilter['avatar_url'] = $userUpdateDTO->getAvatarUrl();
        }

        // 处理昵称
        if (in_array('nickname', $permission, true) && $userUpdateDTO->isFieldPresent('nickname')) {
            $updateFilter['nickname'] = $userUpdateDTO->getNickname();
        }

        // 处理职业身份
        if (in_array('profession', $permission, true) && $userUpdateDTO->isFieldPresent('profession')) {
            $updateFilter['profession'] = $userUpdateDTO->getProfession();
        }

        // 处理获知渠道
        if (in_array('channel', $permission, true) && $userUpdateDTO->isFieldPresent('channel')) {
            $updateFilter['channel'] = $userUpdateDTO->getChannel();
        }

        // 处理时区
        if (in_array('timezone', $permission, true) && $userUpdateDTO->isFieldPresent('timezone')) {
            $updateFilter['timezone'] = $userUpdateDTO->getTimezone();
        }

        // 处理偏好设置，序列化为 JSON 字符串存储
        if (in_array('preferences', $permission, true) && $userUpdateDTO->isFieldPresent('preferences')) {
            $preferences = $userUpdateDTO->getPreferences();
            $updateFilter['preferences'] = $preferences !== null ? json_encode($preferences->toArray(), JSON_UNESCAPED_UNICODE) : null;
        }

        return $this->userRepository->updateDataById($userId, $updateFilter);
    }
}
