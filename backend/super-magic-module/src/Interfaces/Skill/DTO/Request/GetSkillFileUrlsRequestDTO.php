<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Batch get skill file URLs request DTO.
 */
class GetSkillFileUrlsRequestDTO extends AbstractRequestDTO
{
    /**
     * Skill ID list (string format to avoid snowflake ID precision loss).
     *
     * @var string[]
     */
    public array $skillIds = [];

    /**
     * Get skill ID list.
     *
     * @return string[]
     */
    public function getSkillIds(): array
    {
        return $this->skillIds;
    }

    /**
     * Get skill IDs as integers.
     *
     * @return int[]
     */
    public function getSkillIdsAsInt(): array
    {
        return array_map('intval', $this->skillIds);
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'skill_ids' => 'required|array|min:1|max:100',
            'skill_ids.*' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'skill_ids.required' => 'skill_ids cannot be empty',
            'skill_ids.array' => 'skill_ids must be an array',
            'skill_ids.min' => 'skill_ids must contain at least 1 item',
            'skill_ids.max' => 'skill_ids cannot exceed 100 items',
            'skill_ids.*.required' => 'Each skill_id cannot be empty',
            'skill_ids.*.string' => 'Each skill_id must be a string',
        ];
    }
}
