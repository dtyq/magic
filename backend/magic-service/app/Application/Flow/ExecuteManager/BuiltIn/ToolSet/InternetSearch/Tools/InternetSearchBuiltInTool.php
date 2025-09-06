<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\InternetSearch\Tools;

use App\Application\Chat\Service\MagicChatAISearchV2AppService;
use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Chat\DTO\AISearch\Request\MagicChatAggregateSearchReqDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\SearchDeepLevel;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

use function di;

#[BuiltInToolDefine]
class InternetSearchBuiltInTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::InternetSearch->getCode();
    }

    public function getName(): string
    {
        return 'internet_search';
    }

    public function getDescription(): string
    {
        return '麦吉互联网搜索，批量对用户的多个含义相同或者不同的问题进行互联网搜索。';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $args = $executionData->getTriggerData()->getParams();
            $questions = $args['questions'] ?? [];
            $useDeepSearch = $args['use_deep_search'] ?? false;
            if (empty($questions)) {
                return null;
            }
            $userQuestion = implode(' ', $questions);
            $conversationId = $executionData->getOriginConversationId();
            if ($executionData->getExecutionType()->isDebug()) {
                // debug 模式
                return ['deep_internet_search : current not support debug model'];
            }
            $topicId = $executionData->getTopicId();
            $searchKeywordMessage = new TextMessage();
            $searchKeywordMessage->setContent($userQuestion);
            $magicChatAggregateSearchReqDTO = (new MagicChatAggregateSearchReqDTO())
                ->setConversationId($conversationId)
                ->setTopicId((string) $topicId)
                ->setUserMessage($searchKeywordMessage)
                ->setSearchDeepLevel($useDeepSearch ? SearchDeepLevel::DEEP : SearchDeepLevel::SIMPLE);
            di(MagicChatAISearchV2AppService::class)->aggregateSearch($magicChatAggregateSearchReqDTO);
            return null;
        };
    }

    public function getInput(): ?NodeInput
    {
        $input = new NodeInput();
        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "",
    "items": null,
    "value": null,
    "required": [
        "questions"
    ],
    "properties": {
        "questions": {
            "type": "array",
            "key": "questions",
            "title": "用户问题列表",
            "description": "用户问题列表",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "string",
                "key": "question",
                "sort": 0,
                "title": "question",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            },
            "properties": null
        },
        "use_deep_search": {
            "type": "boolean",
            "key": "use_deep_search",
            "title": "是否使用深度搜索",
            "description": "是否使用深度搜索",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $input;
    }
}
