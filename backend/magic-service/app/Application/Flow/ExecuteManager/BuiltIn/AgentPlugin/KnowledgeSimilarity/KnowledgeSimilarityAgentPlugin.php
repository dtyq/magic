<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\AgentPlugin\KnowledgeSimilarity;

use App\Application\Flow\ExecuteManager\BuiltIn\AgentPlugin\AbstractAgentPlugin;
use App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AIImage\Tools\KnowledgeSimilarityBuiltInTool;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\Structure\KnowledgeConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\Structure\KnowledgeOperator;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\AgentPluginDefine;

#[AgentPluginDefine(code: 'knowledge_similarity', name: '知识库数据', description: '挂载知识数据，用于 RAG 检索')]
class KnowledgeSimilarityAgentPlugin extends AbstractAgentPlugin
{
    private KnowledgeConfig $knowledgeConfig;

    private array $toolsClass = [
        KnowledgeSimilarityBuiltInTool::class,
    ];

    public function getParamsTemplate(): array
    {
        return ['knowledge_config' => (new KnowledgeConfig())->toArray()];
    }

    public function parseParams(array $params): array
    {
        $knowledgeConfig = new KnowledgeConfig();
        $knowledgeConfig->setOperator(KnowledgeOperator::tryFrom($params['knowledge_config']['operator'] ?? '') ?? KnowledgeOperator::Developer);
        $knowledgeConfig->setLimit((int) ($params['knowledge_config']['limit'] ?? 5));
        $knowledgeConfig->setScore((float) ($params['knowledge_config']['score'] ?? 0.4));
        $knowledgeConfig->setKnowledgeListByData($params['knowledge_config']['knowledge_list'] ?? []);

        $this->knowledgeConfig = $knowledgeConfig;

        return [
            'knowledge_config' => $knowledgeConfig->toArray(),
        ];
    }

    public function getAppendSystemPrompt(): ?string
    {
        if (empty($this->knowledgeConfig->getKnowledgeList())) {
            return '';
        }
        $appendSystemPrompt = '';
        foreach ($this->toolsClass as $toolsClass) {
            $tool = \Hyperf\Support\make($toolsClass);
            if ($tool instanceof KnowledgeSimilarityBuiltInTool) {
                $appendSystemPrompt .= $tool->getAppendSystemPrompt([
                    'knowledge_list' => $this->knowledgeConfig->getKnowledgeList(),
                ]) . "\n";
            }
        }
        return $appendSystemPrompt;
    }

    public function getTools(): array
    {
        if (empty($this->knowledgeConfig->getKnowledgeList())) {
            return [];
        }
        $tools = [];
        foreach ($this->toolsClass as $toolsClass) {
            $tool = \Hyperf\Support\make($toolsClass);
            if ($tool instanceof KnowledgeSimilarityBuiltInTool) {
                $customSystemInput = $tool->getCustomSystemInput();
                $customSystemInput?->getFormComponent()?->getForm()?->appendConstValue([
                    'knowledge_list' => array_map(fn ($knowledge) => $knowledge->toArray(), $this->knowledgeConfig->getKnowledgeList()),
                    'knowledge_codes' => $this->knowledgeConfig->getKnowledgeCodes(),
                    'limit' => $this->knowledgeConfig->getLimit(),
                    'score' => $this->knowledgeConfig->getScore(),
                ]);
                $tools[] = $tool;
            }
        }

        return $tools;
    }
}
