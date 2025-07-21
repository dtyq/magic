<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\Structure;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class KnowledgeConfig
{
    protected KnowledgeOperator $operator = KnowledgeOperator::Developer;

    /**
     * @var array<Knowledge>
     */
    private array $knowledgeList = [];

    private int $limit = 5;

    private float $score = 0.4;

    public function toArray(): array
    {
        return [
            'operator' => $this->operator->value,
            'knowledge_list' => array_map(fn (Knowledge $knowledge) => $knowledge->toArray(), $this->knowledgeList),
            'limit' => $this->limit,
            'score' => $this->score,
        ];
    }

    public function getKnowledgeCodes(): array
    {
        return array_map(fn (Knowledge $knowledge) => $knowledge->getKnowledgeCode(), $this->knowledgeList);
    }

    public function getKnowledgeList(): array
    {
        return $this->knowledgeList;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function getScore(): float
    {
        return $this->score;
    }

    public function getOperator(): KnowledgeOperator
    {
        return $this->operator;
    }

    public function setOperator(KnowledgeOperator $operator): void
    {
        $this->operator = $operator;
    }

    public function setKnowledgeList(array $knowledgeList): void
    {
        $this->knowledgeList = $knowledgeList;
    }

    public function setKnowledgeListByData(array $data): void
    {
        // 实时获取知识库数据
        $knowledgeCodes = array_column($data, 'knowledge_code');
        if (empty($knowledgeCodes)) {
            return;
        }
        $query = new KnowledgeBaseQuery();
        $query->setCodes($knowledgeCodes);
        $knowledgeEntitiesData = di(KnowledgeBaseDomainService::class)->queries(KnowledgeBaseDataIsolation::create()->disabled(), $query, Page::createNoPage())['list'];
        $knowledgeEntities = [];
        foreach ($knowledgeEntitiesData as $knowledgeEntity) {
            $knowledgeEntities[$knowledgeEntity->getCode()] = $knowledgeEntity;
        }

        $knowledgeList = [];
        foreach ($data as $knowledgeItem) {
            if (empty($knowledgeItem['knowledge_type'])) {
                continue;
            }
            $type = (int) $knowledgeItem['knowledge_type'];
            if (! $type) {
                continue;
            }
            if (empty($knowledgeItem['knowledge_code'])) {
                continue;
            }
            $knowledgeEntity = $knowledgeEntities[$knowledgeItem['knowledge_code']] ?? null;
            $knowledge = new Knowledge(
                $knowledgeItem['knowledge_code'],
                $type,
                $knowledgeEntity?->getBusinessId() ?? ($knowledgeItem['business_id'] ?? ''),
                $knowledgeEntity?->getName() ?? ($knowledgeItem['name'] ?? ''),
                $knowledgeEntity?->getDescription() ?? ($knowledgeItem['description'] ?? '')
            );
            $knowledgeList[] = $knowledge;
        }

        $this->knowledgeList = $knowledgeList;
    }

    public function setLimit(int $limit): void
    {
        $min = 1;
        $max = 100;
        if ($limit < $min || $limit > $max) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.knowledge_similarity.limit_valid', ['min' => $min, 'max' => $max]);
        }

        $this->limit = $limit;
    }

    public function setScore(float $score): void
    {
        if ($score <= 0 || $score >= 1) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.knowledge_similarity.score_valid');
        }
        $this->score = $score;
    }
}
