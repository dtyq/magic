<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 回收站内移动项目请求 DTO.
 *
 * 用于接收回收站内项目移动的请求参数.
 * 特殊处理：target_workspace_id 为空字符串表示移动到"无工作区".
 */
class MoveProjectInRecycleBinRequestDTO extends AbstractRequestDTO
{
    /**
     * 源项目ID.
     */
    public string $sourceProjectId = '';

    /**
     * 目标工作区ID.
     * 空字符串表示移动到"无工作区".
     */
    public string $targetWorkspaceId = '';

    /**
     * 获取源项目ID.
     */
    public function getSourceProjectId(): int
    {
        return (int) $this->sourceProjectId;
    }

    /**
     * 获取目标工作区ID.
     * 当移动到"无工作区"时返回 null.
     *
     * @return null|int 工作区ID 或 null（表示无工作区）
     */
    public function getTargetWorkspaceId(): ?int
    {
        // 空字符串表示"移动到无工作区"
        if ($this->targetWorkspaceId === '') {
            return null;
        }

        return (int) $this->targetWorkspaceId;
    }

    /**
     * 检查是否移动到"无工作区".
     *
     * @return bool 是否移动到无工作区
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
            'source_project_id' => 'required|numeric',
            'target_workspace_id' => 'present|string|max:64',
        ];
    }

    /**
     * 获取自定义错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'source_project_id.required' => '源项目ID不能为空',
            'source_project_id.numeric' => '源项目ID必须是有效的数字',
            'target_workspace_id.present' => '目标工作区ID字段必填',
            'target_workspace_id.string' => '目标工作区ID必须是字符串',
            'target_workspace_id.max' => '目标工作区ID不能超过64个字符',
        ];
    }
}
