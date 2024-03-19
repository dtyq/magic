<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\VectorDatabase\Similarity;

use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\FullTextSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\GraphSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\HybridSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\SemanticSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\SimilaritySearchDriverInterface;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeRetrievalResult;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrievalMethod;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseFragmentDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Db;

class KnowledgeSimilarityManager
{
    public function __construct(
        protected KnowledgeBaseDomainService $knowledgeBaseDomainService,
    ) {
    }

    /**
     * @return array<KnowledgeRetrievalResult>
     */
    public function similarity(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeSimilarityFilter $filter, ?RetrieveConfig $retrieveConfig = null): array
    {
        $filter->validate();

        $query = new KnowledgeBaseQuery();
        $query->setCodes($filter->getKnowledgeCodes());
        $knowledgeList = $this->knowledgeBaseDomainService->queries($dataIsolation, $query, Page::createNoPage())['list'];
        if (empty($knowledgeList)) {
            return [];
        }
        $defaultRetrieveConfig = new RetrieveConfig();
        $defaultRetrieveConfig->setSearchMethod(RetrievalMethod::SEMANTIC_SEARCH);
        $defaultRetrieveConfig->setTopK($filter->getLimit());
        $defaultRetrieveConfig->setScoreThreshold($filter->getScore());

        $result = [];
        foreach ($knowledgeList as $knowledge) {
            if (! $knowledge->isEnabled()) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.disabled', ['code' => $knowledge->getCode()]);
            }
            if (! $retrieveConfig) {
                $retrieveConfig = $knowledge->getRetrieveConfig() ?? $defaultRetrieveConfig;
            }
            $knowledge->setRetrieveConfig($retrieveConfig);
            $similaritySearchInterface = match ($retrieveConfig->getSearchMethod()) {
                RetrievalMethod::FULL_TEXT_SEARCH => FullTextSimilaritySearchInterface::class,
                RetrievalMethod::HYBRID_SEARCH => HybridSimilaritySearchInterface::class,
                RetrievalMethod::GRAPH_SEARCH => GraphSimilaritySearchInterface::class,
                default => SemanticSimilaritySearchInterface::class,
            };
            if (container()->has($similaritySearchInterface)) {
                /** @var SimilaritySearchDriverInterface $similaritySearchDriver */
                $similaritySearchDriver = di($similaritySearchInterface);
                $retrievalResults = $similaritySearchDriver->search($dataIsolation, $filter, $knowledge, $retrieveConfig);
                foreach ($retrievalResults as $data) {
                    $result[] = $data;
                }
            }
        }

        return $result;
    }

    public function destroyByMetadataFilter(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $knowledgeBaseEntity, KnowledgeSimilarityFilter $filter): void
    {
        $max = 10;
        $filter->setLimit(1000);
        while ($max) {
            --$max;
            // 从向量库中先获取数据
            $points = $knowledgeBaseEntity->getVectorDBDriver()->queryPoints(
                $knowledgeBaseEntity->getCollectionName(),
                $filter->getLimit(),
                $filter->getMetadataFilter(),
            );
            $pointIds = [];
            foreach ($points as $point) {
                $fragment = KnowledgeBaseFragmentEntity::createByPointInfo($point, $knowledgeBaseEntity->getCode());
                $pointIds[] = $fragment->getPointId();
            }
            if (empty($pointIds)) {
                break;
            }

            Db::transaction(function () use ($dataIsolation, $knowledgeBaseEntity, $filter, $pointIds) {
                $fragmentDomainService = di(KnowledgeBaseFragmentDomainService::class);
                $fragmentDomainService->batchDestroyByPointIds(
                    $dataIsolation,
                    $knowledgeBaseEntity,
                    $pointIds
                );
                // 还需要删除相同 point_id 的内容，因为目前允许重复
                $knowledgeBaseEntity->getVectorDBDriver()->removeByFilter(
                    $knowledgeBaseEntity->getCollectionName(),
                    $filter->getMetadataFilter(),
                );
            });
        }
    }
}
