<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 批量重排序 Playbook 请求 DTO.
 */
class ReorderPlaybooksRequestDTO extends AbstractRequestDTO
{
    /**
     * Playbook ID 列表，按新顺序排列.
     *
     * @var string[]
     */
    public array $ids = [];

    /**
     * 获取 Playbook ID 列表.
     *
     * @return string[]
     */
    public function getIds(): array
    {
        return $this->ids;
    }

    /**
     * 获取 Hyperf 验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'ids' => 'required|array',
            'ids.*' => 'required|integer|min:1',
        ];
    }

    /**
     * 获取 Hyperf 验证消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'ids.required' => __('crew.ids_required'),
            'ids.array' => __('crew.ids_must_be_array'),
            'ids.*.required' => __('crew.playbook_id_required'),
            'ids.*.integer' => __('crew.playbook_id_must_be_integer'),
            'ids.*.min' => __('crew.playbook_id_min_1'),
        ];
    }
}
