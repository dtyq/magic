<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AIImage\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AbstractBuiltInTool;
use App\Application\Flow\ExecuteManager\Compressible\CompressibleContent;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityFilter;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityManager;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\Structure\Knowledge;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use Closure;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

#[BuiltInToolDefine]
class KnowledgeSimilarityBuiltInTool extends AbstractBuiltInTool
{
    private ?NodeInput $input = null;

    private ?NodeInput $customSystemInput = null;

    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AtomicNode->getCode();
    }

    public function getName(): string
    {
        return 'knowledge_similarity';
    }

    public function getDescription(): string
    {
        return '使用用户问题和关键词，去检索知识库中的内容，返回与用户问题相似度最高的内容。';
    }

    public function getAppendSystemPrompt(array $customParams = []): string
    {
        $knowledgeList = $customParams['knowledge_list'] ?? [];
        if (empty($knowledgeList)) {
            return '';
        }
        $knowledgePrompt = '';
        /** @var Knowledge $knowledge */
        foreach ($knowledgeList as $knowledge) {
            $knowledgePrompt .= "- {$knowledge->getName()}：{$knowledge->getDescription()}\n";
        }
        return <<<MARKDOWN
# 允许被使用的能力: 知识库检索
## 知识库列表
> 知识库名称：知识库描述
{$knowledgePrompt}
## 流程
1. 结合上下文提炼用户的问题，生成多个关键词，最多不超过 5 个，多个关键词用英文逗号"," 隔开，用于使用不同关键词从知识库中检索最相关的信息；
2. 结合上下文，分析用户的问题，生成 `names` 参数，用于指定与用户问题可能有关的多个知识库名称，按照相关性排序，相关性需结合上下文、知识库名称和知识库描述进行判断；
3. 使用关键词和用户问题，调用 `{$this->getName()}` 工具检索知识库中的内容，关键词的参数是 `keyword`，用户问题的参数是 `question`, 请确保参数都被正确填入，工具将返回与用户问题相似度最高的内容片段；
4. 知识库检索出来的内容里会包含一些自定义的 Magic 标签，你要善于使用它们，有以下几种标签：
    - <MagicImage></MagicImage> 表示一个图片，如 <MagicImage>cp_xxxxxxx</MagicImage>，每个标签都会在前端消息卡片渲染出一张图片；
    - <MagicVideo></MagicVideo> 表示一个视频，如 <MagicVideo>cp_xxxxxxx</MagicVideo>，每个标签都会在前端消息卡片渲染出一个视频；
    - <MagicMention></MagicMention> 表示一个人员信息，如 <MagicMention>cp_xxxxxxx</MagicMention>，每个标签都会在前端消息卡片形成一个 @某某人 的效果；
5. 优先使用包含 <MagicImage></MagicImage>、<MagicVideo></MagicVideo>、<MagicMention></MagicMention> 等有 Magic 标签的片段；
6. 结合知识库返回的内容整理后尽可能丰富地回答用户的问题。
## 工具中关键的返回值说明
- fragments: 本次检索到的所有知识库片段
- fragments.*.content: 片段内容
- fragments.*.metadata.url: 当前片段的原文链接
- graph.*.content: 来自知识图谱的数据，能增强信息，让你更好回答问题
## 限制
- 回答的内容中不允许出现不是Magic标签的链接。
MARKDOWN;
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $params = $executionData->getTriggerData()->getParams();
            $customParams = $executionData->getTriggerData()->getSystemParams();

            $knowledgeList = $customParams['knowledge_list'] ?? [];
            $query = $params['keyword'] ?? '';
            $question = $params['question'] ?? '';

            if (empty($knowledgeList) || empty($query)) {
                return [];
            }
            $limit = $customParams['limit'] ?? 5;
            $score = $customParams['score'] ?? 0.4;

            $similarityCodes = [];
            $names = $params['names'] ?? [];
            foreach ($names as $name) {
                foreach ($knowledgeList as $item) {
                    if (empty($item['name']) || empty($item['knowledge_code'])) {
                        continue;
                    }
                    if ($name === $item['name']) {
                        $similarityCodes[] = $item['knowledge_code'];
                    }
                }
            }
            if (empty($similarityCodes)) {
                $similarityCodes = $customParams['knowledge_codes'] ?? [];
            }

            $knowledgeSimilarity = new KnowledgeSimilarityFilter();
            $knowledgeSimilarity->setKnowledgeCodes($similarityCodes);
            $knowledgeSimilarity->setQuery($query);
            $knowledgeSimilarity->setQuestion($question);
            $knowledgeSimilarity->setLimit($limit);
            $knowledgeSimilarity->setScore($score);

            $dataIsolation = $executionData->getDataIsolation();
            $knowledgeBaseDataIsolation = KnowledgeBaseDataIsolation::createByBaseDataIsolation($dataIsolation);
            $fragments = di(KnowledgeSimilarityManager::class)->similarity($knowledgeBaseDataIsolation, $knowledgeSimilarity);

            $similarityContents = [];
            $fragmentList = [];
            foreach ($fragments as $fragment) {
                $similarityContents[] = $fragment->getContent();
                $fragmentList[] = [
                    'business_id' => $fragment->getBusinessId(),
                    'content' => CompressibleContent::compress($fragment->getContent()),
                    'metadata' => $fragment->getMetadata(),
                ];
            }

            return [
                'similarities' => $similarityContents,
                'fragments' => $fragmentList,
            ];
        };
    }

    public function isShow(): bool
    {
        return false;
    }

    public function getInput(): ?NodeInput
    {
        if ($this->input) {
            return $this->input;
        }
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
        "keyword",
        "question"
    ],
    "properties": {
         "keyword": {
            "type": "string",
            "key": "keyword",
            "sort": 0,
            "title": "搜索关键字",
            "description": "搜索关键字",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "question": {
            "type": "string",
            "key": "question",
            "sort": 0,
            "title": "用户的原始问题",
            "description": "用户的原始问题",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "names": {
            "type": "array",
            "key": "names",
            "sort": 1,
            "title": "知识库 names",
            "description": "需要被检索的知识库名称",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "string",
                "key": "names",
                "sort": 0,
                "title": "names",
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
        $this->input = $input;
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
        "content"
    ],
    "properties": {
         "content": {
            "type": "string",
            "key": "content",
            "sort": 0,
            "title": "检索到的所有内容",
            "description": "",
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
        return $output;
    }

    public function getCustomSystemInput(): ?NodeInput
    {
        if ($this->customSystemInput) {
            return $this->customSystemInput;
        }
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
        "knowledge_codes",
        "limit",
        "score"
    ],
    "properties": {
        "knowledge_codes": {
            "type": "array",
            "key": "knowledge_codes",
            "title": "知识库 codes",
            "description": "",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "string",
                "key": "knowledge_codes",
                "sort": 0,
                "title": "knowledge_codes",
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
        "knowledge_list": {
            "type": "array",
            "key": "knowledge_list",
            "title": "知识库列表",
            "description": "",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": {
                "type": "object",
                "key": "knowledge_list",
                "title": "knowledge_list",
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
         "limit": {
            "type": "number",
            "key": "limit",
            "title": "最大召回数量",
            "description": "",
            "required": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "score": {
            "type": "number",
            "key": "score",
            "title": "相似度",
            "description": "",
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
        $this->customSystemInput = $input;
        return $input;
    }
}
