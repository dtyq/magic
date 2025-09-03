<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 更新项目置顶状态请求 DTO
 * 用于接收置顶/取消置顶项目的请求参数.
 */
class UpdateProjectPinRequestDTO extends AbstractRequestDTO
{
    /**
     * 是否置顶：false-取消置顶，true-置顶.
     */
    public bool $isPin = false;

    /**
     * 获取是否置顶.
     */
    public function getIsPin(): bool
    {
        return $this->isPin;
    }

    /**
     * 设置是否置顶.
     */
    public function setIsPin(bool $isPin): void
    {
        $this->isPin = $isPin;
    }

    /**
     * 检查是否为置顶操作.
     */
    public function isPinOperation(): bool
    {
        return $this->isPin;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'is_pin' => 'required|boolean',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'is_pin.required' => __('project.pin.is_pin_required'),
            'is_pin.boolean' => __('project.pin.is_pin_must_be_boolean'),
        ];
    }
}
