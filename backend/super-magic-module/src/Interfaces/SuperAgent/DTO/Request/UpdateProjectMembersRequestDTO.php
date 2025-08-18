<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 更新项目成员请求DTO
 *
 * 封装更新项目成员的请求参数和验证逻辑
 * 继承AbstractRequestDTO，自动支持参数验证和类型转换
 */
class UpdateProjectMembersRequestDTO extends AbstractRequestDTO
{
    /** @var string 项目ID（来自路由参数） */
    private string $projectId = '';

    /** @var array 成员数据列表 */
    private array $members = [];

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getMembers(): array
    {
        return $this->members;
    }

    public function setMembers(array $members): void
    {
        $this->members = $members;
    }

    /**
     * 定义验证规则
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'members' => 'nullable|array|min:0|max:500',
            'members.*.target_type' => 'required|string|in:User,Department',
            'members.*.target_id' => 'required|string|max:128',
        ];
    }

    /**
     * 定义验证错误消息（多语言支持）
     */
    protected static function getHyperfValidationMessage(): array
    {

        return [
            'members.required' => __('validation.project.members.required'),
            'members.array' => __('validation.project.members.array'),
            'members.min' => __('validation.project.members.min'),
            'members.max' => __('validation.project.members.max'),
            'members.*.target_type.required' => __('validation.project.target_type.required'),
            'members.*.target_type.string' => __('validation.project.target_type.string'),
            'members.*.target_type.in' => __('validation.project.target_type.in'),
            'members.*.target_id.required' => __('validation.project.target_id.required'),
            'members.*.target_id.string' => __('validation.project.target_id.string'),
            'members.*.target_id.max' => __('validation.project.target_id.max'),
        ];
    }
}
