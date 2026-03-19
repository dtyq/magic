<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 批量移动回收站项目请求 DTO.
 *
 * 参考现有 BatchMoveProjectsRequestDTO 设计.
 */
class BatchMoveProjectInRecycleBinRequestDTO extends AbstractRequestDTO
{
    /**
     * 项目ID数组（字段名与现有批量接口保持一致）.
     */
    public array $projectIds = [];

    /**
     * 目标工作区ID（空字符串表示"无工作区"）.
     */
    public string $targetWorkspaceId = '';

    /**
     * 获取项目ID数组.
     *
     * @return array<string> 返回字符串数组（雪花ID保持字符串）
     */
    public function getProjectIds(): array
    {
        return $this->projectIds;
    }

    /**
     * 获取整型项目ID数组（供内部使用）.
     *
     * @return array<int>
     */
    public function getProjectIdsAsInt(): array
    {
        return array_map('intval', $this->projectIds);
    }

    /**
     * 获取目标工作区ID.
     */
    public function getTargetWorkspaceId(): ?int
    {
        if ($this->targetWorkspaceId === '') {
            return null;
        }
        return (int) $this->targetWorkspaceId;
    }

    /**
     * 检查是否移动到"无工作区".
     */
    public function isMovingToNoWorkspace(): bool
    {
        return $this->targetWorkspaceId === '';
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_ids' => 'required|array|min:1|max:20',
            'project_ids.*' => 'required|string',
            'target_workspace_id' => 'present|string|max:64',
        ];
    }

    /**
     * 获取自定义错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_ids.required' => '项目ID列表不能为空',
            'project_ids.array' => '项目ID必须是数组',
            'project_ids.min' => '至少需要选择一个项目',
            'project_ids.max' => '最多只能同时移动20个项目',
            'project_ids.*.required' => '每个项目ID不能为空',
            'project_ids.*.string' => '每个项目ID必须是字符串',
            'target_workspace_id.present' => '目标工作区ID字段必填',
            'target_workspace_id.string' => '目标工作区ID必须是字符串',
            'target_workspace_id.max' => '目标工作区ID不能超过64个字符',
        ];
    }
}
