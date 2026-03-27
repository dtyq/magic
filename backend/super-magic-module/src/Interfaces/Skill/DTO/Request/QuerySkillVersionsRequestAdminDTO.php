<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 查询 Skill 版本列表请求 Admin DTO - 用于管理后台.
 */
class QuerySkillVersionsRequestAdminDTO extends AbstractRequestDTO
{
    public int $page = 1;

    public int $pageSize = 20;

    public ?string $reviewStatus = null;

    public ?string $publishStatus = null;

    public ?string $publishTargetType = null;

    public ?string $sourceType = null;

    public ?string $version = null;

    /**
     * 包名模糊检索（匹配 magic_skill_versions.package_name）.
     */
    public ?string $packageName = null;

    /**
     * 技能名称模糊检索（匹配 magic_skill_versions.name_i18n 各语言键）.
     */
    public ?string $skillName = null;

    public ?string $organizationCode = null;

    public string $orderBy = 'desc';

    public ?string $startTime = null;

    public ?string $endTime = null;

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int|string $value): void
    {
        $this->page = (int) $value;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int|string $value): void
    {
        $this->pageSize = (int) $value;
    }

    public function getReviewStatus(): ?string
    {
        return $this->reviewStatus;
    }

    public function getPublishStatus(): ?string
    {
        return $this->publishStatus;
    }

    public function getPublishTargetType(): ?string
    {
        return $this->publishTargetType;
    }

    public function getSourceType(): ?string
    {
        return $this->sourceType;
    }

    public function getVersion(): ?string
    {
        return $this->version;
    }

    public function getPackageName(): ?string
    {
        return $this->packageName;
    }

    public function getSkillName(): ?string
    {
        return $this->skillName;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    public function getStartTime(): ?string
    {
        return $this->startTime;
    }

    public function getEndTime(): ?string
    {
        return $this->endTime;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'review_status' => 'nullable|string',
            'publish_status' => 'nullable|string',
            'publish_target_type' => 'nullable|string',
            'source_type' => 'nullable|string',
            'version' => 'nullable|string',
            'package_name' => 'nullable|string|max:255',
            'skill_name' => 'nullable|string|max:255',
            'organization_code' => 'nullable|string|max:128',
            'order_by' => 'nullable|string|in:asc,desc',
            'start_time' => 'nullable|string',
            'end_time' => 'nullable|string',
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
            'review_status.string' => __('validation.string', ['attribute' => 'review_status']),
            'publish_status.string' => __('validation.string', ['attribute' => 'publish_status']),
            'publish_target_type.string' => __('validation.string', ['attribute' => 'publish_target_type']),
            'source_type.string' => __('validation.string', ['attribute' => 'source_type']),
            'version.string' => __('validation.string', ['attribute' => 'version']),
            'package_name.string' => __('validation.string', ['attribute' => 'package_name']),
            'package_name.max' => __('validation.max.string', ['attribute' => 'package_name', 'max' => 255]),
            'skill_name.string' => __('validation.string', ['attribute' => 'skill_name']),
            'skill_name.max' => __('validation.max.string', ['attribute' => 'skill_name', 'max' => 255]),
            'organization_code.string' => __('validation.string', ['attribute' => 'organization_code']),
            'organization_code.max' => __('validation.max.string', ['attribute' => 'organization_code', 'max' => 128]),
            'order_by.string' => __('validation.string', ['attribute' => 'order_by']),
            'order_by.in' => __('validation.in', ['attribute' => 'order_by']),
            'start_time.string' => __('validation.string', ['attribute' => 'start_time']),
            'end_time.string' => __('validation.string', ['attribute' => 'end_time']),
        ];
    }
}
