<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Helper\InvitationPermissionMapper;

/**
 * 邀请链接响应DTO.
 *
 * 用于返回邀请链接的基本信息
 */
class InvitationLinkResponseDTO
{
    public function __construct(
        public readonly string $id,
        public readonly string $projectId,
        public readonly string $token,
        public readonly bool $isEnabled,
        public readonly bool $isPasswordEnabled,
        public readonly ?string $password,
        public readonly string $defaultJoinPermission,
        public readonly string $createdBy,
        public readonly string $createdAt,
    ) {
    }

    /**
     * 从ResourceShareEntity创建DTO.
     */
    public static function fromEntity(
        ResourceShareEntity $shareEntity,
        ResourceShareDomainService $resourceShareDomainService
    ): self {
        return new self(
            id: (string) $shareEntity->getId(),
            projectId: $shareEntity->getResourceId(),
            token: $shareEntity->getShareCode(),
            isEnabled: $shareEntity->getIsEnabled(),
            isPasswordEnabled: $shareEntity->getIsPasswordEnabled(),
            password: $resourceShareDomainService->getDecryptedPassword($shareEntity),
            defaultJoinPermission: InvitationPermissionMapper::shareTypeToPermission($shareEntity->getShareType()),
            createdBy: $shareEntity->getCreatedUid(),
            createdAt: $shareEntity->getCreatedAt(),
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->projectId,
            'token' => $this->token,
            'is_enabled' => $this->isEnabled,
            'is_password_enabled' => $this->isPasswordEnabled,
            'password' => $this->isPasswordEnabled ? $this->password : '',
            'default_join_permission' => $this->defaultJoinPermission,
            'created_by' => $this->createdBy,
            'created_at' => $this->createdAt,
        ];
    }
}
