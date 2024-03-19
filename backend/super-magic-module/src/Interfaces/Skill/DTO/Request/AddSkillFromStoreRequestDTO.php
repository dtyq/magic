<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 从技能市场添加技能请求 DTO.
 */
class AddSkillFromStoreRequestDTO extends AbstractRequestDTO
{
    /**
     * 商店技能 ID.
     */
    public string $storeSkillId = '';

    /**
     * 获取商店技能 ID.
     */
    public function getStoreSkillId(): string
    {
        return $this->storeSkillId;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'store_skill_id' => 'required|string',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'store_skill_id.required' => __('skill.store_skill_id_required'),
            'store_skill_id.string' => __('skill.store_skill_id_must_be_string'),
        ];
    }
}
