<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 协作项目列表响应DTO.
 */
class CollaborationProjectListResponseDTO
{
    public function __construct(
        public readonly array $list,
        public readonly int $total
    ) {
    }

    /**
     * 从项目数据创建响应DTO.
     *
     * @param int $total 总数
     */
    public static function fromProjectData(
        array $projects,
        array $collaborationProjects,
        array $creatorInfoMap = [],
        array $collaboratorsInfoMap = [],
        array $workspaceNameMap = [],
        int $total = 0
    ): self {
        $projectIdMapEntities = [];
        foreach ($projects as $project) {
            $projectIdMapEntities[$project->getId()] = $project;
        }

        $list = array_map(function ($collaborationProject) use ($creatorInfoMap, $collaboratorsInfoMap, $workspaceNameMap, $projectIdMapEntities) {
            $projectId = $collaborationProject['project_id'];
            $projectEntity = $projectIdMapEntities[$projectId] ?? null;
            if (! $projectEntity) {
                return [];
            }

            $workspaceName = $workspaceNameMap[$projectEntity->getWorkspaceId()] ?? null;
            $creator = $creatorInfoMap[$projectEntity->getUserId()] ?? null;
            $collaboratorsInfo = $collaboratorsInfoMap[$projectId] ?? ['members' => [], 'member_count' => 0];
            $isPinned = (bool) ($collaborationProject['is_pinned'] ?? false);
            $lastActiveAt = $collaborationProject['last_active_at'] ?? null;

            return CollaborationProjectItemDTO::fromEntityWithExtendedInfo(
                $projectEntity,
                $creator,
                $collaboratorsInfo['members'],
                $collaboratorsInfo['member_count'],
                null,
                $workspaceName,
                $isPinned,
                $lastActiveAt
            )->toArray();
        }, $collaborationProjects);

        return new self(
            list: $list,
            total: $total ?: count($projects),
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
        ];
    }
}
