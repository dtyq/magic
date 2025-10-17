<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 批量更新成员权限请求DTO.
 *
 * 封装批量更新成员权限的请求参数和验证逻辑
 * 继承AbstractRequestDTO，自动支持参数验证和类型转换
 */
class BatchUpdateMembersRequestDTO extends AbstractRequestDTO
{
    /** @var array 成员权限更新数据列表 */
    public array $members = [];

    public function getMembers(): array
    {
        return $this->members;
    }

    public function setMembers(array $members): void
    {
        $this->members = $members;
    }

    /**
     * 定义验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'members' => 'required|array|min:1|max:500',
            'members.*.member_id' => 'required|string|max:128',
            'members.*.permission' => 'required|string',
        ];
    }

    /**
     * 定义验证错误消息（多语言支持）.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'members.required' => __('validation.project.members.required'),
            'members.array' => __('validation.project.members.array'),
            'members.min' => __('validation.project.members.min'),
            'members.max' => __('validation.project.members.max'),
            'members.*.member_id.required' => __('validation.project.member_id.required'),
            'members.*.member_id.string' => __('validation.project.member_id.string'),
            'members.*.member_id.max' => __('validation.project.member_id.max'),
            'members.*.permission.required' => __('validation.project.permission.required'),
            'members.*.permission.string' => __('validation.project.permission.string'),
            'members.*.permission.in' => __('validation.project.permission.in'),
        ];
    }
}
