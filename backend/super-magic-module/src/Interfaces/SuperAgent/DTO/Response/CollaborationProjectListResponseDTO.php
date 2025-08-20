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
     * @param array $projects 项目实体数组
     * @param array $creatorInfoMap 创建人信息映射
     * @param array $collaboratorsInfoMap 协作者信息映射 ['projectId' => ['members' => [], 'member_count' => 0]]
     * @param array $workspaceNameMap 工作区名称映射
     * @param int $total 总数
     */
    public static function fromProjectData(
        array $projects,
        array $creatorInfoMap = [],
        array $collaboratorsInfoMap = [],
        array $workspaceNameMap = [],
        int $total = 0
    ): self {
        $list = array_map(function ($project) use ($creatorInfoMap, $collaboratorsInfoMap, $workspaceNameMap) {
            $projectId = $project->getId();
            $workspaceName = $workspaceNameMap[$project->getWorkspaceId()] ?? null;
            $creator = $creatorInfoMap[$project->getUserId()] ?? null;
            $collaboratorsInfo = $collaboratorsInfoMap[$projectId] ?? ['members' => [], 'member_count' => 0];

            return CollaborationProjectItemDTO::fromEntityWithExtendedInfo(
                $project,
                $creator,
                $collaboratorsInfo['members'],
                $collaboratorsInfo['member_count'],
                null,
                $workspaceName
            )->toArray();
        }, $projects);

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
