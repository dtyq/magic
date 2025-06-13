<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\InternetSearch\Tools;

use App\Application\Chat\Service\MagicAISearchToolAppService;
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
use Throwable;

use function di;

#[BuiltInToolDefine]
/**
 * 麦吉互联网搜索工具版本，只返回搜索结果，不推送websocket消息。
 */
class InternetSearchSummaryBuiltInTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::InternetSearch->getCode();
    }

    public function getName(): string
    {
        return 'internet_search_summary_tool';
    }

    public function getDescription(): string
    {
        return '麦吉互联网搜索总结纯工具版，不推送消息';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $args = $executionData->getTriggerData()?->getParams();
            $questions = $args['questions'] ?? [];
            $useDeepSearch = $args['use_deep_search'] ?? false;

            if (empty($questions)) {
                return ['error' => '问题列表不能为空'];
            }

            $userQuestion = implode(' ', $questions);
            $conversationId = $executionData->getOriginConversationId();

            if ($executionData->getExecutionType()->isDebug()) {
                // debug 模式返回模拟结果
                return [
                    'summary' => '这是调试模式下的模拟搜索结果',
                    'search_contexts' => [],
                    'user_question' => $userQuestion,
                    'search_deep_level' => $useDeepSearch ? 'DEEP' : 'SIMPLE',
                ];
            }

            $topicId = $executionData->getTopicId();
            $searchKeywordMessage = new TextMessage();
            $searchKeywordMessage->setContent($userQuestion);

            // 从ExecutionData中获取组织编码和用户ID
            $organizationCode = $executionData->getDataIsolation()->getCurrentOrganizationCode();
            $userId = $executionData->getDataIsolation()->getCurrentUserId();

            $magicChatAggregateSearchReqDTO = (new MagicChatAggregateSearchReqDTO())
                ->setConversationId($conversationId)
                ->setTopicId((string) $topicId)
                ->setUserMessage($searchKeywordMessage)
                ->setSearchDeepLevel($useDeepSearch ? SearchDeepLevel::DEEP : SearchDeepLevel::SIMPLE)
                ->setOrganizationCode($organizationCode)
                ->setUserId($userId);

            try {
                if ($useDeepSearch) {
                    // 使用深度搜索工具
                    $searchResult = di(MagicAISearchToolAppService::class)->executeInternetSearch($magicChatAggregateSearchReqDTO, true, 'deepInternetSearchForToolError');
                } else {
                    // 使用简单搜索工具
                    $searchResult = di(MagicAISearchToolAppService::class)->executeInternetSearch($magicChatAggregateSearchReqDTO, false, 'aggregateSearchError');
                }

                if ($searchResult === null) {
                    return ['error' => '搜索结果为空，可能是由于防重复机制或其他原因'];
                }

                // 返回搜索结果
                return [
                    'summary' => $searchResult->getLlmResponse(),
                    'search_contexts' => $this->formatSearchContexts($searchResult->getSearchContext()),
                    'user_question' => $userQuestion,
                    'search_deep_level' => $useDeepSearch ? SearchDeepLevel::DEEP->value : SearchDeepLevel::SIMPLE->value,
                ];
            } catch (Throwable $e) {
                return [
                    'error' => '搜索过程中发生错误: ' . $e->getMessage(),
                    'user_question' => $userQuestion,
                ];
            }
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
JSON
            ,
            true
        )));
        return $input;
    }

    /**
     * 格式化搜索上下文，只返回必要的信息.
     */
    private function formatSearchContexts(array $searchContexts): array
    {
        $formatted = [];
        foreach ($searchContexts as $context) {
            if (is_object($context) && method_exists($context, 'toArray')) {
                $contextArray = $context->toArray();
            } else {
                $contextArray = (array) $context;
            }

            // 只保留关键信息，移除可能很大的detail字段
            $formatted[] = [
                'title' => $contextArray['title'] ?? '',
                'url' => $contextArray['url'] ?? '',
                'snippet' => $contextArray['snippet'] ?? '',
                'cached_page_url' => $contextArray['cached_page_url'] ?? '',
                // 不包含detail字段以减少数据量
            ];
        }
        return $formatted;
    }
}
