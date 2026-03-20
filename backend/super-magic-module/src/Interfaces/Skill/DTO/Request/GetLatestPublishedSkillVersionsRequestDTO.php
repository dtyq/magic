<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

class GetLatestPublishedSkillVersionsRequestDTO extends AbstractRequestDTO
{
    public int $page = 1;

    public int $pageSize = 20;

    /**
     * @var array<int, string>
     */
    public ?array $codes = null;

    public ?string $keyword = null;

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * @return array<int, string>
     */
    public function getCodes(): ?array
    {
        return $this->codes;
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'codes' => 'nullable|array|max:200',
            'codes.*' => 'nullable|string|max:64',
            'keyword' => 'nullable|string|max:255',
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
            'codes.array' => __('validation.array', ['attribute' => 'codes']),
            'codes.max' => __('validation.max.array', ['attribute' => 'codes', 'max' => 200]),
            'codes.*.string' => __('validation.string', ['attribute' => 'codes.*']),
            'codes.*.max' => __('validation.max.string', ['attribute' => 'codes.*', 'max' => 64]),
            'keyword.string' => __('validation.string', ['attribute' => 'keyword']),
            'keyword.max' => __('validation.max.string', ['attribute' => 'keyword', 'max' => 255]),
        ];
    }
}
