<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Closure;

use function Hyperf\Translation\__;

class UpdateSkillCategoryRequestAdminDTO extends AbstractRequestDTO
{
    public ?string $parentId = null;

    public ?array $nameI18n = null;

    public ?string $logo = null;

    public ?int $sortOrder = null;

    public ?int $status = null;

    private bool $parentIdProvided = false;

    private bool $logoProvided = false;

    public function setParentId(?string $parentId): void
    {
        $this->parentId = $parentId === null ? '0' : $parentId;
        $this->parentIdProvided = true;
    }

    public function setLogo(?string $logo): void
    {
        $this->logo = $logo;
        $this->logoProvided = true;
    }

    /** @return array{parent_id?: string, name_i18n?: array, logo?: ?string, sort_order?: int, status?: int} */
    public function getUpdatePayload(): array
    {
        $payload = [];
        if ($this->parentIdProvided) {
            $payload['parent_id'] = (string) $this->parentId;
        }
        if ($this->nameI18n !== null) {
            $payload['name_i18n'] = $this->nameI18n;
        }
        if ($this->logoProvided) {
            $payload['logo'] = $this->logo;
        }
        if ($this->sortOrder !== null) {
            $payload['sort_order'] = $this->sortOrder;
        }
        if ($this->status !== null) {
            $payload['status'] = $this->status;
        }
        return $payload;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'parent_id' => 'sometimes|string|regex:/^\d+$/',
            'name_i18n' => [
                'sometimes',
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
            'logo' => 'sometimes|nullable|string|max:512',
            'sort_order' => 'sometimes|integer',
            'status' => 'sometimes|integer|in:0,1',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
