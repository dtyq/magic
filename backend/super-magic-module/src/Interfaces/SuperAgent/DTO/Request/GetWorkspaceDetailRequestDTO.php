<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

class GetWorkspaceDetailRequestDTO
{
    protected string $workspaceId;

    public function __construct(array $data = [])
    {
        $this->workspaceId = (string) ($data['workspace_id'] ?? '');
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }
}
