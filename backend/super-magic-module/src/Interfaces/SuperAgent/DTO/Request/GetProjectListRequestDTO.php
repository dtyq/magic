<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

/**
 * 获取项目列表请求DTO
 */
class GetProjectListRequestDTO
{
    public function __construct(
        public readonly string $userId = '',
        public readonly string $userOrganizationCode = '',
        public readonly ?int $workspaceId = null,
        public readonly int $page = 1,
        public readonly int $pageSize = 20
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            userId: (string) ($data['user_id'] ?? ''),
            userOrganizationCode: (string) ($data['user_organization_code'] ?? ''),
            workspaceId: isset($data['workspace_id']) ? (int) $data['workspace_id'] : null,
            page: (int) ($data['page'] ?? 1),
            pageSize: (int) ($data['page_size'] ?? 20)
        );
    }
}