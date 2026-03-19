<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use App\Domain\Contact\Entity\MagicUserEntity;

/**
 * 删除人用户信息 DTO.
 * 用于回收站列表返回删除人的详细信息.
 */
class DeletedByUserDTO
{
    public string $userId = '';

    public string $nickname = '';

    public string $avatar = '';

    /**
     * 从用户实体创建 DTO.
     *
     * @param null|MagicUserEntity $userEntity 用户实体，如果用户不存在则为 null
     * @return null|self 如果用户不存在返回 null
     */
    public static function fromEntity(?MagicUserEntity $userEntity): ?self
    {
        if ($userEntity === null) {
            return null;
        }

        $dto = new self();
        $dto->userId = $userEntity->getUserId();
        $dto->nickname = $userEntity->getNickname();
        $dto->avatar = $userEntity->getAvatarUrl() ?? '';

        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'user_id' => $this->userId,
            'nickname' => $this->nickname,
            'avatar' => $this->avatar,
        ];
    }
}
