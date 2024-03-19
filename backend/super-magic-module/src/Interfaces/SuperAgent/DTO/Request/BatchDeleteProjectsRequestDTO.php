<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Batch delete projects request DTO.
 */
class BatchDeleteProjectsRequestDTO extends AbstractRequestDTO
{
    /**
     * Project IDs to delete.
     */
    public array $projectIds = [];

    public function getProjectIds(): array
    {
        return $this->projectIds;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_ids' => 'required|array|min:1|max:20',
            'project_ids.*' => 'required|numeric|min:1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_ids.required' => 'Project IDs cannot be empty',
            'project_ids.array' => 'Project IDs must be an array',
            'project_ids.min' => 'At least one project ID is required',
            'project_ids.max' => 'Cannot delete more than 20 projects at once',
            'project_ids.*.required' => 'Project ID cannot be empty',
            'project_ids.*.numeric' => 'Project ID must be numeric',
            'project_ids.*.min' => 'Project ID must be greater than 0',
        ];
    }
}
