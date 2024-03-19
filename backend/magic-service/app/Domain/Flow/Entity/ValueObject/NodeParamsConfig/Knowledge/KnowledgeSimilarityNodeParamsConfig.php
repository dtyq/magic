<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class KnowledgeSimilarityNodeParamsConfig extends AbstractKnowledgeNodeParamsConfig
{
    private array $knowledgeCodes = [];

    private ?Component $vectorDatabaseIds = null;

    private Component $query;

    private int $limit = 5;

    private float $score = 0.4;

    public function getVectorDatabaseIds(): ?Component
    {
        return $this->vectorDatabaseIds;
    }

    public function getKnowledgeCodes(): array
    {
        return $this->knowledgeCodes;
    }

    public function getQuery(): Component
    {
        return $this->query;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function getScore(): float
    {
        return $this->score;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $this->knowledgeCodes = $params['knowledge_codes'] ?? [];

        $vectorDatabaseIds = ComponentFactory::fastCreate($params['vector_database_ids'] ?? []);
        if ($vectorDatabaseIds && ! $vectorDatabaseIds->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'vector_database_ids']);
        }
        $this->vectorDatabaseIds = $vectorDatabaseIds;

        $query = ComponentFactory::fastCreate($params['query'] ?? []);
        if (! $query?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'query']);
        }
        $this->query = $query;

        $limit = $params['limit'] ?? 5;
        $min = 1;
        $max = 100;
        if (! is_numeric($limit) || $limit < $min || $limit > $max) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.knowledge_similarity.limit_valid', ['min' => $min, 'max' => $max]);
        }
        $this->limit = (int) $limit;

        $score = $params['score'] ?? 0.4;
        if (! is_float($score) || $score <= 0 || $score >= 1) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.knowledge_similarity.score_valid');
        }
        $this->score = (float) $score;

        $metadataFilter = ComponentFactory::fastCreate($params['metadata_filter'] ?? []);
        if ($metadataFilter && ! $metadataFilter->isForm()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'metadata_filter']);
        }
        $this->metadataFilter = $metadataFilter;

        return [
            'knowledge_codes' => $this->knowledgeCodes,
            'vector_database_ids' => $this->vectorDatabaseIds?->toArray(),
            'query' => $this->query->toArray(),
            'metadata_filter' => $this->metadataFilter?->toArray(),
            'limit' => $this->limit,
            'score' => $this->score,
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'knowledge_codes' => $this->knowledgeCodes,
            'vector_database_ids' => ComponentFactory::generateTemplate(StructureType::Value),
            'query' => ComponentFactory::generateTemplate(StructureType::Value),
            'metadata_filter' => ComponentFactory::generateTemplate(StructureType::Form),
            'limit' => $this->limit,
            'score' => $this->score,
        ]);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(<<<'JSON'
    {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "similarity_contents",
            "similarity_content"
        ],
        "properties": {
            "similarity_contents": {
                "type": "array",
                "key": "similarity_contents",
                "sort": 0,
                "title": "召回的结果集",
                "description": "",
                "required": null,
                "value": null,
                "items": {
                    "type": "string",
                    "key": "0",
                    "sort": 0,
                    "title": "结果",
                    "description": "",
                    "required": null,
                    "value": null,
                    "items": null,
                    "properties": null
                },
                "properties": null
            },
            "similarity_content": {
                "type": "string",
                "key": "similarity_content",
                "sort": 1,
                "title": "召回的结果",
                "description": "",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            },
            "fragments": {
                "type": "array",
                "key": "root",
                "sort": 2,
                "title": "片段列表",
                "description": "",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": {
                    "type": "object",
                    "key": "fragment",
                    "sort": 0,
                    "title": "片段",
                    "description": "",
                    "required": [
                        "content"
                    ],
                    "value": null,
                    "encryption": false,
                    "encryption_value": null,
                    "items": null,
                    "properties": {
                        "content": {
                            "type": "string",
                            "key": "content",
                            "sort": 0,
                            "title": "内容",
                            "description": "",
                            "required": null,
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": null
                        },
                        "business_id": {
                            "type": "string",
                            "key": "business_id",
                            "sort": 0,
                            "title": "业务 ID",
                            "description": "",
                            "required": null,
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": null
                        },
                        "metadata": {
                            "type": "object",
                            "key": "file_url",
                            "sort": 2,
                            "title": "元数据",
                            "description": "",
                            "required": null,
                            "value": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": null,
                            "properties": null
                        }
                    }
                },
                "properties": null
            }
        }
    }
JSON)));
        $this->node->setOutput($output);
    }
}
