<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Project\DTO\Request;

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

    public ?string $targetWorkspaceId = null;

    public ?string $preProjectId = null;

    public ?string $nextProjectId = null;

    public bool $preProjectIdProvided = false;

    public bool $nextProjectIdProvided = false;

    public function getTargetWorkspaceId(): ?int
    {
        return $this->targetWorkspaceId === null || $this->targetWorkspaceId === '' ? null : (int) $this->targetWorkspaceId;
    }

    public function getPreProjectId(): ?int
    {
        return $this->preProjectId === null || $this->preProjectId === '' ? null : (int) $this->preProjectId;
    }

    public function getNextProjectId(): ?int
    {
        return $this->nextProjectId === null || $this->nextProjectId === '' ? null : (int) $this->nextProjectId;
    }

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
            'target_workspace_id' => 'nullable|string|max:64',
            'pre_project_id' => 'nullable|string',
            'next_project_id' => 'nullable|string',
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
