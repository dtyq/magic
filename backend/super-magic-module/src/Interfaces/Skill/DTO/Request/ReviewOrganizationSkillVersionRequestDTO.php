<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Hyperf\Validation\Rule;

use function Hyperf\Translation\__;

/**
 * 组织后台审核 Skill 版本请求 DTO.
 */
class ReviewOrganizationSkillVersionRequestDTO extends AbstractRequestDTO
{
    /**
     * 审核操作：APPROVED=通过, REJECTED=拒绝。
     */
    public string $action = '';

    /**
     * 审核说明，同意/拒绝均可为空。
     */
    public ?string $reviewRemark = null;

    public function getAction(): string
    {
        return $this->action;
    }

    public function isApproved(): bool
    {
        return $this->action === 'APPROVED';
    }

    public function getReviewRemark(): ?string
    {
        return $this->reviewRemark;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'action' => ['required', 'string', Rule::in(['APPROVED', 'REJECTED'])],
            'review_remark' => ['nullable', 'string', 'max:1000'],
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'action.required' => __('skill.action_required'),
            'action.string' => __('skill.action_must_be_string'),
            'action.in' => __('skill.invalid_review_action'),
            'review_remark.string' => __('validation.string', ['attribute' => 'review_remark']),
            'review_remark.max' => __('validation.max.string', ['attribute' => 'review_remark', 'max' => 1000]),
        ];
    }
}
