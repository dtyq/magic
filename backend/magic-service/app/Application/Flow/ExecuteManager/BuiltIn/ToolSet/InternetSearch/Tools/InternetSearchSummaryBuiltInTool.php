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
 * Magic internet search tool version, only returns search results, does not push websocket messages.
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
        return 'Magic internet search summary tool-only version, does not push messages.';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $args = $executionData->getTriggerData()?->getParams();
            $keywords = $args['keywords'] ?? [];
            $useDeepSearch = $args['use_deep_search'] ?? false;

            if (empty($keywords)) {
                return ['error' => 'Keyword list cannot be empty'];
            }

            $userQuestion = implode(' ', $keywords);
            $conversationId = $executionData->getOriginConversationId();

            if ($executionData->getExecutionType()->isDebug()) {
                // Return mock results in debug mode
                return [
                    'web_details' => 'This is a concatenated string of multiple web page details',
                    'search_contexts' => [],
                ];
            }

            $topicId = $executionData->getTopicId();
            $searchKeywordMessage = new TextMessage();
            $searchKeywordMessage->setContent($userQuestion);

            // Get organization code and user ID from ExecutionData
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
                    // Use deep search tool
                    $searchResult = di(MagicAISearchToolAppService::class)->executeInternetSearch($magicChatAggregateSearchReqDTO, true, 'deepInternetSearchForToolError');
                } else {
                    // Use simple search tool
                    $searchResult = di(MagicAISearchToolAppService::class)->executeInternetSearch($magicChatAggregateSearchReqDTO, false, 'aggregateSearchError');
                }

                if ($searchResult === null) {
                    return ['error' => 'Search result is empty, may be due to anti-duplication mechanism or other reasons'];
                }

                // Return search results
                return [
                    'web_details' => $searchResult->getLlmResponse(), // This is now the concatenated string of web page details
                    'search_contexts' => $this->formatSearchContexts($searchResult->getSearchContext()),
                ];
            } catch (Throwable $e) {
                return [
                    'error' => 'An error occurred during the search process: ' . $e->getMessage(),
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
    "title": "root node",
    "description": "",
    "items": null,
    "value": null,
    "required": [
        "keywords"
    ],
    "properties": {
        "keywords": {
            "type": "array",
            "key": "keywords",
            "title": "User Keyword List",
            "description": "User Keyword List",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "string",
                "key": "keyword",
                "sort": 0,
                "title": "keyword",
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
            "title": "Use Deep Search",
            "description": "Use Deep Search",
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

    /**
     * Format the search context, returning only necessary information.
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

            // Keep only key information, remove the potentially large detail field
            $formatted[] = [
                'title' => $contextArray['title'] ?? '',
                'url' => $contextArray['url'] ?? '',
                'snippet' => $contextArray['snippet'] ?? '',
                'cached_page_url' => $contextArray['cached_page_url'] ?? '',
                // Does not include the detail field to reduce data volume
            ];
        }
        return $formatted;
    }
}
