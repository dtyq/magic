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

    public static function fromResult(
        array $result,
        array $workspaceNameMap = [],
        array $projectIdsWithMember = [],
        array $projectStatusMap = [],
        array $topicCountMap = []
    ): self {
        $projects = $result['list'] ?? $result;
        $total = $result['total'] ?? count($projects);

        $list = [];
        foreach ($projects as $project) {
            $workspaceName = $workspaceNameMap[$project->getWorkspaceId()] ?? null;
            $hasProjectMember = in_array($project->getId(), $projectIdsWithMember);
            $projectStatus = $projectStatusMap[$project->getId()] ?? null;
            $projectData = ProjectItemDTO::fromEntity($project, $projectStatus, $workspaceName, $hasProjectMember)->toArray();
            $projectData['topic_count'] = $topicCountMap[$project->getId()] ?? 0;
            $projectData['is_pinned'] = $project->isPinned();
            $projectData['pinned_at'] = $project->getPinnedAt();
            $list[] = $projectData;
        }

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
