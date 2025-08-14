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
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

use function di;

#[BuiltInToolDefine]
/**
 * 采用一个 seq 推送所有的搜索相关内容，前端不再多个 seq 合并成一个渲染.
 */
class EasyInternetSearchV2BuiltInTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::InternetSearch->getCode();
    }

    public function getName(): string
    {
        return 'easy_internet_search_v2';
    }

    public function getDescription(): string
    {
        return '麦吉互联网搜索简单版，批量对用户的多个含义相同或者不同的问题进行互联网搜索。';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            /** @var MagicUserEntity $userEntity */
            $userEntity = $executionData->getTriggerData()->getUserInfo()['user_entity'] ?? null;
            $args = $executionData->getTriggerData()->getParams();
            $questions = $args['questions'] ?? [];
            $userQuestion = implode('', $questions);
            $conversationId = $executionData->getOriginConversationId();
            $topicId = $executionData->getTopicId();
            $searchKeywordMessage = new TextMessage();
            $searchKeywordMessage->setContent($userQuestion);
            $magicChatAggregateSearchReqDTO = (new MagicChatAggregateSearchReqDTO())
                ->setConversationId($conversationId)
                ->setTopicId((string) $topicId)
                ->setUserMessage($searchKeywordMessage)
                ->setSearchDeepLevel(SearchDeepLevel::SIMPLE)
                ->setUserId($userEntity->getUserId())
                ->setOrganizationCode($userEntity->getOrganizationCode());
            return di(MagicChatAISearchV2AppService::class)->easyInternetSearch($magicChatAggregateSearchReqDTO);
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
        }
    }
}
JSON,
            true
        )));
        return $input;
    }

    public function getOutPut(): ?NodeOutput
    {
        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, json_decode(
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
        "url"
    ],
    "properties": {
        "search": {
            "type": "array",
            "key": "search",
            "title": "搜索结果",
            "description": "搜索结果",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "array",
                "key": "item",
                "sort": 0,
                "title": "item",
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
        "llm_response": {
            "type": "array",
            "key": "llm_response",
            "title": "大模型响应",
            "description": "大模型响应",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "array",
                "key": "item",
                "sort": 0,
                "title": "item",
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
        "related_questions": {
            "type": "array",
            "key": "related_questions",
            "title": "关联问题",
            "description": "关联问题",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "array",
                "key": "item",
                "sort": 0,
                "title": "item",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": null
            },
            "properties": null
        }
    }
}
JSON,
            true
        )));
        return $output;
    }
}
