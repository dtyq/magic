<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\InternetSearch\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Domain\Chat\Entity\ValueObject\SearchEngineType;
use App\Domain\Chat\Service\MagicLLMDomainService;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

use function di;

#[BuiltInToolDefine]
class BingInternetSearchBuiltInTool extends AbstractBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::InternetSearch->getCode();
    }

    public function getName(): string
    {
        return 'bing_internet_search';
    }

    public function getDescription(): string
    {
        return 'Bing互联网搜索';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $args = $executionData->getTriggerData()->getParams();
            $searchKeyword = $args['search_keyword'] ?? '';
            $count = (int) ($args['result_count'] ?? 10);
            $clearSearch = di(MagicLLMDomainService::class)->search($searchKeyword, SearchEngineType::Bing)['clear_search'];
            $clearSearch = array_slice($clearSearch, 0, $count);
            $clearSearch = array_map(function ($item) {
                return [
                    'url' => $item['url'] ?? '',
                    'snippet' => $item['snippet'] ?? '',
                ];
            }, $clearSearch);
            return [
                'clear_search' => $clearSearch,
            ];
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
        "search_keyword"
    ],
    "properties": {
        "search_keyword": {
            "type": "string",
            "key": "search_keyword",
            "title": "搜索词",
            "description": "搜索词",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "result_count": {
            "type": "integer",
            "key": "result_count",
            "title": "返回结果数量",
            "description": "返回结果数量",
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
        "clear_search": {
            "type": "array",
            "key": "clear_search",
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
        }
    }
}
JSON,
            true
        )));
        return $output;
    }
}
