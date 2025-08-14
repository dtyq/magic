<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 项目列表响应DTO.
 */
class ProjectListResponseDTO
{
    public function __construct(
        public readonly array $list,
        public readonly int $total
    ) {
    }

    public static function fromResult(array $result, array $projectStatusMap = [], array $workspaceNameMap = []): self
    {
        $projects = $result['list'] ?? $result;
        $total = $result['total'] ?? count($projects);

        $list = array_map(function ($project) use ($projectStatusMap, $workspaceNameMap) {
            $projectStatus = $projectStatusMap[$project->getId()] ?? null;
            $workspaceName = $workspaceNameMap[$project->getWorkspaceId()] ?? null;
            return ProjectItemDTO::fromEntity($project, $projectStatus, $workspaceName)->toArray();
        }, $projects);

        return new self(
            list: $list,
            total: $total,
        );
    }

    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
        ];
    }
}
