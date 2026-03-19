<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 回收站话题移动请求 DTO.
 */
class MoveTopicInRecycleBinRequestDTO extends AbstractRequestDTO
{
    protected string $sourceTopicId = '';

    protected string $targetProjectId = '';

    public function getSourceTopicId(): int
    {
        return (int) $this->sourceTopicId;
    }

    public function getTargetProjectId(): int
    {
        return (int) $this->targetProjectId;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'source_topic_id' => 'required|numeric',
            'target_project_id' => 'required|numeric',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'source_topic_id.required' => '话题ID不能为空',
            'source_topic_id.numeric' => '话题ID必须是有效的数字',
            'target_project_id.required' => '目标项目ID不能为空',
            'target_project_id.numeric' => '目标项目ID必须是有效的数字',
        ];
    }
}
