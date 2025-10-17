<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 更新项目协作设置请求DTO.
 *
 * 封装更新项目协作设置的请求参数和验证逻辑
 * 继承AbstractRequestDTO，自动支持参数验证和类型转换
 */
class UpdateCollaborationRequestDTO extends AbstractRequestDTO
{
    /** @var bool 是否启用协作功能 */
    public bool $enabled = false;

    /** @var string 默认权限 */
    public string $permission = 'editor';

    public function getEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getPermission(): string
    {
        return $this->permission;
    }

    public function setPermission(string $permission): void
    {
        $this->permission = $permission;
    }

    /**
     * 定义验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'enabled' => 'boolean',
            'permission' => 'string',
        ];
    }

    /**
     * 定义验证错误消息（多语言支持）.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'enabled.boolean' => __('validation.project.enabled.boolean'),
            'permission.string' => __('validation.project.permission.string'),
            'permission.in' => __('validation.project.permission.in'),
        ];
    }
}
