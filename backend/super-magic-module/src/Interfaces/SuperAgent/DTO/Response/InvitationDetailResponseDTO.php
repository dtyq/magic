<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 邀请链接详情响应DTO.
 *
 * 用于外部用户预览邀请链接信息
 */
class InvitationDetailResponseDTO
{
    public function __construct(
        public readonly string $projectId,
        public readonly string $projectName,
        public readonly string $projectDescription,
        public readonly string $organizationCode,
        public readonly string $creatorId,
        public readonly string $creatorName,
        public readonly string $creatorAvatar,
        public readonly string $defaultJoinPermission,
        public readonly bool $requiresPassword,
        public readonly string $token,
        public readonly bool $hasJoined,
    ) {
    }

    /**
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            projectId: $data['project_id'],
            projectName: $data['project_name'],
            projectDescription: $data['project_description'],
            organizationCode: $data['organization_code'],
            creatorId: $data['creator_id'],
            creatorName: $data['creator_name'],
            creatorAvatar: $data['creator_avatar'],
            defaultJoinPermission: $data['default_join_permission'],
            requiresPassword: $data['requires_password'],
            token: $data['token'],
            hasJoined: $data['has_joined'],
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'project_id' => $this->projectId,
            'project_name' => $this->projectName,
            'project_description' => $this->projectDescription,
            'organization_code' => $this->organizationCode,
            'creator_id' => $this->creatorId,
            'creator_name' => $this->creatorName,
            'creator_avatar' => $this->creatorAvatar,
            'default_join_permission' => $this->defaultJoinPermission,
            'requires_password' => $this->requiresPassword,
            'token' => $this->token,
            'has_joined' => $this->hasJoined,
        ];
    }
}
