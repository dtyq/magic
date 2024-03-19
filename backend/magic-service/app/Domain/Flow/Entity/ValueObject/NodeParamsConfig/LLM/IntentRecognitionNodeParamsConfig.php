<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure\ModelConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class IntentRecognitionNodeParamsConfig extends AbstractLLMNodeParamsConfig
{
    private array $branches = [];

    public function getBranches(): array
    {
        return $this->branches;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $this->model = $this->formatModel($params['model'] ?? null);

        $branches = $params['branches'] ?? [];
        if (empty($branches)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.common.empty', ['label' => 'branches']);
        }

        foreach ($branches as $branch) {
            if (empty($branch['branch_type']) || empty($branch['branch_id'])) {
                continue;
            }
            if ($branch['branch_type'] === 'else') {
                $this->branches[] = [
                    'branch_id' => $branch['branch_id'],
                    'branch_type' => $branch['branch_type'],
                    'title' => null,
                    'desc' => null,
                    'next_nodes' => $branch['next_nodes'] ?? [],
                ];
                continue;
            }
            $title = ComponentFactory::fastCreate($branch['title'] ?? []);
            if (! $title?->isValue()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'title']);
            }
            $desc = ComponentFactory::fastCreate($branch['desc'] ?? []);
            if (! $desc?->isValue()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'desc']);
            }
            $this->branches[] = [
                'branch_id' => $branch['branch_id'],
                'branch_type' => $branch['branch_type'],
                'title' => $title,
                'desc' => $desc,
                'next_nodes' => $branch['next_nodes'] ?? [],
            ];
        }

        $this->modelConfig = new ModelConfig(
            autoMemory: (bool) ($params['model_config']['auto_memory'] ?? true),
            maxRecord: (int) ($params['model_config']['max_record'] ?? ($params['max_record'] ?? 50)),
            temperature: (float) ($params['model_config']['temperature'] ?? 0.5)
        );

        return [
            'model' => $this->model->getValue()->getResult(),
            'model_config' => $this->modelConfig->getLLMChatConfig(),
            'branches' => array_map(fn (array $branch) => [
                'branch_id' => $branch['branch_id'],
                'branch_type' => $branch['branch_type'],
                'title' => ! is_null($branch['title']) ? $branch['title']->jsonSerialize() : null,
                'desc' => ! is_null($branch['desc']) ? $branch['desc']->jsonSerialize() : null,
                'next_nodes' => $branch['next_nodes'],
            ], $this->branches),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'model' => 'gpt-4o-mini-global',
            'model_config' => (new ModelConfig())->getLLMChatConfig(),
            'branches' => [
                [
                    'branch_id' => uniqid('branch_'),
                    'branch_type' => 'if',
                    'title' => ComponentFactory::generateTemplate(StructureType::Value)->jsonSerialize(),
                    'desc' => ComponentFactory::generateTemplate(StructureType::Value)->jsonSerialize(),
                    'next_nodes' => [],
                    'parameters' => null,
                ],
                [
                    'branch_id' => uniqid('branch_'),
                    'branch_type' => 'else',
                    'title' => '',
                    'desc' => '',
                    'next_nodes' => [],
                    'parameters' => null,
                ],
            ],
        ]);
        $nodeInput = new NodeInput();
        $nodeInput->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(
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
            "intent"
        ],
        "properties": {
            "intent": {
                "type": "string",
                "key": "intent",
                "sort": 0,
                "title": "意图",
                "description": "",
                "items": null,
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON
        )));
        $this->node->setInput($nodeInput);
        $this->node->setOutput(null);
    }
}
