<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 参与项目列表响应DTO.
 */
class ParticipatedProjectListResponseDTO
{
    public function __construct(
        public readonly array $list,
        public readonly int $total
    ) {
    }

    /**
     * 从查询结果创建响应DTO.
     *
     * @param array $result 查询结果（包含 list 和 total）
     * @param array $workspaceNameMap 工作区名称映射
     * @param array $projectIdsWithMember 有成员的项目ID数组
     * @param array $projectStatusMap 项目状态映射 ['project_id' => 'status']
     */
    public static function fromResult(
        array $result,
        array $workspaceNameMap = [],
        array $projectIdsWithMember = [],
        array $projectStatusMap = []
    ): self {
        $projects = $result['list'] ?? $result;
        $total = $result['total'] ?? count($projects);

        $list = array_map(function ($projectData) use ($workspaceNameMap, $projectIdsWithMember, $projectStatusMap) {
            $workspaceName = $workspaceNameMap[$projectData['workspace_id']] ?? null;
            $hasProjectMember = in_array($projectData['id'], $projectIdsWithMember);
            $calculatedStatus = $projectStatusMap[$projectData['id']] ?? null;
            return ParticipatedProjectItemDTO::fromArray($projectData, $workspaceName, $hasProjectMember, $calculatedStatus)->toArray();
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
