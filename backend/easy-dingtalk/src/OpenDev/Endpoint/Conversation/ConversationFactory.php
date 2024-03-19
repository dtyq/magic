<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\Conversation;

use Dtyq\EasyDingTalk\OpenDev\Result\Conversation\CreateGroupResult;
use Dtyq\EasyDingTalk\OpenDev\Result\Conversation\CreateSceneGroupResult;

class ConversationFactory
{
    /**
     * 根据原始数据创建场景群结果对象
     *
     * @param array $rawData 原始响应数据
     */
    public static function createSceneGroupResultByRawData(array $rawData): CreateSceneGroupResult
    {
        return new CreateSceneGroupResult($rawData);
    }

    /**
     * 根据原始数据创建群组结果对象
     *
     * @param array $rawData 原始响应数据
     */
    public static function createGroupResultByRawData(array $rawData): CreateGroupResult
    {
        return new CreateGroupResult($rawData);
    }
}
