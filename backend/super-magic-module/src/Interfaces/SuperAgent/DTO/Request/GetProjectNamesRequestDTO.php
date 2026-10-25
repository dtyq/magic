<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class GetProjectNamesRequestDTO extends AbstractRequestDTO
{
    /** @var list<string> */
    public array $projectIds = [];

    /** @return list<string> */
    public function getProjectIds(): array
    {
        return array_values(array_unique($this->projectIds));
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_ids' => 'present|array',
            'project_ids.*' => 'required|string|regex:/^[1-9][0-9]*$/',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
