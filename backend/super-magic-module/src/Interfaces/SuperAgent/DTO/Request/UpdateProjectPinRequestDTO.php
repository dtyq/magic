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
     * 是否置顶：0-取消置顶，1-置顶.
     */
    public int $isPin = 0;

    /**
     * 获取是否置顶.
     */
    public function getIsPin(): int
    {
        return $this->isPin;
    }

    /**
     * 设置是否置顶.
     */
    public function setIsPin(int $isPin): void
    {
        $this->isPin = $isPin;
    }

    /**
     * 检查是否为置顶操作.
     */
    public function isPinOperation(): bool
    {
        return $this->isPin === 1;
    }

    /**
     * 检查是否为取消置顶操作.
     */
    public function isUnpinOperation(): bool
    {
        return $this->isPin === 0;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'is_pin' => 'required|integer|in:0,1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'is_pin.required' => __('project.pin.is_pin_required'),
            'is_pin.integer' => __('project.pin.is_pin_must_be_integer'),
            'is_pin.in' => __('project.pin.is_pin_invalid_value'),
        ];
    }
}
