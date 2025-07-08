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
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
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
     */
    public function getUserUpdatePermission(DataIsolation $dataIsolation): bool
    {
        $userId = $dataIsolation->getCurrentUserId();
        if (empty($userId)) {
            return false;
        }
        return true;
    }

    /**
     * 更新用户信息.
     */
    public function updateUserInfo(DataIsolation $dataIsolation, UserUpdateDTO $userUpdateDTO): int
    {
        if (! $this->getUserUpdatePermission($dataIsolation)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }

        $userId = $dataIsolation->getCurrentUserId();
        $updateFilter = [];

        // 处理头像URL
        if ($userUpdateDTO->getAvatarUrl() !== null) {
            $updateFilter['avatar_url'] = $userUpdateDTO->getAvatarUrl();
        }

        // 处理昵称
        if ($userUpdateDTO->getNickname() !== null) {
            $updateFilter['nickname'] = $userUpdateDTO->getNickname();
        }

        return $this->userRepository->updateDataById($userId, $updateFilter);
    }
}
