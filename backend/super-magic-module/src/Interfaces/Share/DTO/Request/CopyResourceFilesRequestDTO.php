<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 复制资源文件请求DTO.
 */
class CopyResourceFilesRequestDTO extends AbstractRequestDTO
{
    /**
     * 资源ID.
     */
    public string $resourceId = '';

    /**
     * 目标工作区ID.
     */
    public string $targetWorkspaceId = '';

    /**
     * 目标项目名称（可选，默认使用原项目名称）.
     */
    public ?string $targetProjectName = null;

    /**
     * 分享密码（如果分享设置了密码）.
     */
    public ?string $password = null;

    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    public function setResourceId(string $resourceId): void
    {
        $this->resourceId = $resourceId;
    }

    public function getTargetWorkspaceId(): int
    {
        return (int) $this->targetWorkspaceId;
    }

    public function setTargetWorkspaceId(string $targetWorkspaceId): void
    {
        $this->targetWorkspaceId = $targetWorkspaceId;
    }

    public function getTargetProjectName(): ?string
    {
        return $this->targetProjectName;
    }

    public function setTargetProjectName(?string $targetProjectName): void
    {
        $this->targetProjectName = $targetProjectName;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(?string $password): void
    {
        $this->password = $password;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'resource_id' => 'required|string|max:100',
            'target_workspace_id' => 'required|integer|min:1',
            'target_project_name' => 'nullable|string|max:100',
            'password' => 'nullable|string|max:100',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'resource_id.required' => 'Resource ID cannot be empty',
            'resource_id.string' => 'Resource ID must be a string',
            'resource_id.max' => 'Resource ID cannot exceed 100 characters',
            'target_workspace_id.required' => 'Target workspace ID cannot be empty',
            'target_workspace_id.integer' => 'Target workspace ID must be an integer',
            'target_workspace_id.min' => 'Target workspace ID must be greater than 0',
            'target_project_name.string' => 'Target project name must be a string',
            'target_project_name.max' => 'Target project name cannot exceed 100 characters',
            'password.string' => 'Password must be a string',
            'password.max' => 'Password cannot exceed 100 characters',
        ];
    }
}
