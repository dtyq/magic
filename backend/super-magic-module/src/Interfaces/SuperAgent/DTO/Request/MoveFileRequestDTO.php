<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class MoveFileRequestDTO extends AbstractRequestDTO
{
    /**
     * The ID of the target parent directory.
     */
    public string $targetParentId = '';

    /**
     * The ID of the previous file for positioning, 0=first position, -1=last position (default).
     */
    public string $preFileId = '-1';

    /**
     * The ID of the target project (optional, for cross-project move).
     */
    public string $targetProjectId = '';

    public function getTargetParentId(): string
    {
        return $this->targetParentId;
    }

    public function getPreFileId(): string
    {
        return $this->preFileId;
    }

    public function getTargetProjectId(): string
    {
        return $this->targetProjectId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'target_parent_id' => 'nullable|string',
            'pre_file_id' => 'string', // -1表示末尾，0表示第一位，>0表示指定位置
            'target_project_id' => 'nullable|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'target_parent_id.string' => 'Target parent ID must be a string',
            'pre_file_id.string' => 'Pre file ID must be a string',
            'target_project_id.string' => 'Target project ID must be a string',
        ];
    }
}
