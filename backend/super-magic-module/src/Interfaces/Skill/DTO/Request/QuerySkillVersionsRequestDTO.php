<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Hyperf\Validation\Rule;

use function Hyperf\Translation\__;

class QuerySkillVersionsRequestDTO extends AbstractRequestDTO
{
    public int $page = 1;

    public int $pageSize = 20;

    public ?string $publishTargetType = null;

    public ?string $status = null;

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function getPublishTargetType(): ?string
    {
        return $this->publishTargetType;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'publish_target_type' => ['nullable', 'string', Rule::in(['PRIVATE', 'MARKET'])],
            'status' => ['nullable', 'string', Rule::in(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'])],
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => __('skill.page_must_be_integer'),
            'page.min' => __('skill.page_must_be_greater_than_zero'),
            'page_size.integer' => __('skill.page_size_must_be_integer'),
            'page_size.min' => __('skill.page_size_must_be_greater_than_zero'),
            'page_size.max' => __('skill.page_size_must_not_exceed_100'),
            'publish_target_type.string' => __('validation.string', ['attribute' => 'publish_target_type']),
            'publish_target_type.in' => __('skill.publish_target_type_invalid'),
            'status.string' => __('validation.string', ['attribute' => 'status']),
            'status.in' => __('validation.in', ['attribute' => 'status']),
        ];
    }
}
