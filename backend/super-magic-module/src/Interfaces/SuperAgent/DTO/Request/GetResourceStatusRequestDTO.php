<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetResourceStatusRequestDTO extends AbstractDTO
{
    /**
     * @var int[]
     */
    protected array $workspaceIds = [];

    /**
     * @var int[]
     */
    protected array $projectIds = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->setWorkspaceIds(self::normalizeIds((array) $request->input('workspace_ids', [])));
        $dto->setProjectIds(self::normalizeIds((array) $request->input('project_ids', [])));

        return $dto;
    }

    public function getWorkspaceIds(): array
    {
        return $this->workspaceIds;
    }

    public function setWorkspaceIds(array $workspaceIds): self
    {
        $this->workspaceIds = $workspaceIds;

        return $this;
    }

    public function getProjectIds(): array
    {
        return $this->projectIds;
    }

    public function setProjectIds(array $projectIds): self
    {
        $this->projectIds = $projectIds;

        return $this;
    }

    /**
     * @return int[]
     */
    private static function normalizeIds(array $ids): array
    {
        $normalizedIds = array_map(
            'intval',
            array_filter($ids, static fn (mixed $id): bool => $id !== null && $id !== '')
        );

        return array_values(array_unique(array_filter($normalizedIds, static fn (int $id): bool => $id > 0)));
    }
}
