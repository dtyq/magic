<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Closure;

use function Hyperf\Translation\__;

class CreateSkillCategoryRequestAdminDTO extends AbstractRequestDTO
{
    public string $parentId = '0';

    public array $nameI18n;

    public ?string $logo = null;

    public int $sortOrder = 0;

    public int $status = 1;

    protected static function getHyperfValidationRules(): array
    {
        return [
            'parent_id' => 'sometimes|string|regex:/^\d+$/',
            'name_i18n' => [
                'required',
                'array',
                'min:1',
                static function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_array($value)) {
                        return;
                    }
                    foreach ($value as $name) {
                        if (is_string($name) && trim($name) !== '') {
                            return;
                        }
                    }
                    $fail(__('common.parameter_required', ['label' => 'name_i18n']));
                },
            ],
            'name_i18n.*' => 'required|string',
            'logo' => 'nullable|string|max:512',
            'sort_order' => 'sometimes|integer',
            'status' => 'sometimes|integer|in:0,1',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
