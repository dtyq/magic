<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 回收站批量话题移动请求 DTO.
 */
class BatchMoveTopicsInRecycleBinRequestDTO extends AbstractRequestDTO
{
    protected array $topicIds = [];

    protected string $targetProjectId = '';

    public function getTopicIds(): array
    {
        return $this->topicIds;
    }

    public function getTargetProjectId(): int
    {
        return (int) $this->targetProjectId;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'topic_ids' => 'required|array|min:1|max:50',
            'topic_ids.*' => 'required|numeric',
            'target_project_id' => 'required|numeric',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'topic_ids.required' => '话题ID列表不能为空',
            'topic_ids.array' => '话题ID列表必须是数组',
            'topic_ids.min' => '至少需要选择一个话题',
            'topic_ids.max' => '单次最多移动50个话题',
            'topic_ids.*.required' => '话题ID不能为空',
            'topic_ids.*.numeric' => '话题ID必须是有效的数字',
            'target_project_id.required' => '目标项目ID不能为空',
            'target_project_id.numeric' => '目标项目ID必须是有效的数字',
        ];
    }
}
