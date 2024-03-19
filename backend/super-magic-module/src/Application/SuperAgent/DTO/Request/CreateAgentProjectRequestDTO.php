<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create Agent Project Request DTO.
 */
class CreateAgentProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Project name.
     */
    public string $projectName = '';

    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function setProjectName(string $projectName): void
    {
        $this->projectName = $projectName;
    }

    /**
     * Agent projects are always hidden — not exposed as a request parameter.
     */
    public function getIsHidden(): bool
    {
        return true;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_name' => 'required|string|max:255',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_name.required' => 'Project name cannot be empty',
            'project_name.string' => 'Project name must be a string',
            'project_name.max' => 'Project name cannot exceed 255 characters',
        ];
    }
}
