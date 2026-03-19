<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Hyperf\Validation\Rule;

use function Hyperf\Translation\__;

/**
 * 审核员工版本请求 DTO.
 */
class ReviewAgentVersionRequestDTO extends AbstractRequestDTO
{
    /**
     * 审核操作：APPROVED=通过, REJECTED=拒绝.
     */
    public string $action = '';

    /**
     * 发布者类型：USER=普通用户, OFFICIAL=官方运营, VERIFIED_CREATOR=认证创作者, PARTNER=第三方机构.
     */
    public string $publisherType = '';

    /**
     * 获取审核操作.
     */
    public function getAction(): string
    {
        return $this->action;
    }

    /**
     * 获取发布者类型.
     */
    public function getPublisherType(): string
    {
        return $this->publisherType ?: '';
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'action' => ['required', 'string', Rule::in(['APPROVED', 'REJECTED'])],
            'publisher_type' => ['nullable', 'string', Rule::in(['USER', 'OFFICIAL', 'VERIFIED_CREATOR', 'PARTNER'])],
        ];
    }

    /**
     * 获取验证错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'action.required' => __('super_magic.agent.action_required'),
            'action.string' => __('super_magic.agent.action_must_be_string'),
            'action.in' => __('super_magic.agent.invalid_review_action'),
            'publisher_type.string' => __('super_magic.agent.publisher_type_must_be_string'),
            'publisher_type.in' => __('super_magic.agent.publisher_type_invalid'),
        ];
    }
}
