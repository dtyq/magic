<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 加入项目响应DTO.
 *
 * 用于返回用户通过邀请链接加入项目的结果
 */
class JoinProjectResponseDTO
{
    public function __construct(
        public readonly string $projectId,
        public readonly string $userRole,
        public readonly string $joinMethod,
        public readonly string $joinedAt,
    ) {
    }

    /**
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            projectId: $data['project_id'],
            userRole: $data['user_role'],
            joinMethod: $data['join_method'],
            joinedAt: $data['joined_at'],
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'project_id' => $this->projectId,
            'user_role' => $this->userRole,
            'join_method' => $this->joinMethod,
            'joined_at' => $this->joinedAt,
        ];
    }
}
