<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class ResourceStatusResponseDTO extends AbstractDTO
{
    protected array $projectIds = [];

    protected array $workspaceIds = [];

    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->projectIds = array_values($data['project_ids'] ?? []);
        $dto->workspaceIds = array_values($data['workspace_ids'] ?? []);
        return $dto;
    }

    public function toArray(): array
    {
        return [
            'project_ids' => $this->projectIds,
            'workspace_ids' => $this->workspaceIds,
        ];
    }
}
