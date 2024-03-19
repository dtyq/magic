<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver;

use App\Application\KnowledgeBase\VectorDatabase\Similarity\KnowledgeSimilarityFilter;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeRetrievalResult;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\Rerank\RerankGeneratorInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class BaseSemanticSimilaritySearch implements SemanticSimilaritySearchInterface
{
    protected LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function search(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeSimilarityFilter $filter, KnowledgeBaseEntity $knowledgeBaseEntity, RetrieveConfig $retrieveConfig): array
    {
        // 场景验证， 如果开启重新排序，可以多召回数据，然后根据得分进行排序，取 limit ，最多不超过 20 或者 limit 上限
        $queryNum = $filter->getLimit();
        if ($retrieveConfig->isRerankingEnable()) {
            // 如果开启重排序，增加召回数量，但不超过20或原始limit的3倍
            $maxLimit = min(20, $queryNum * 3);
            $filter->setLimit($maxLimit);
        }
        // 兜底方案
        $question = $filter->getQuestion();
        if ($question === '') {
            $question = $filter->getQuery();
        }

        $modelGatewayMapper = di(ModelGatewayMapper::class);

        $result = [];
        // 根据模型进行向量化
        $model = $modelGatewayMapper->getEmbeddingModelProxy($dataIsolation, $knowledgeBaseEntity->getModel());
        $embeddingGenerator = di(EmbeddingGeneratorInterface::class);
        $queryEmbeddings = $embeddingGenerator->embedText($model, $question, options: [
            'business_params' => [
                'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'business_id' => $knowledgeBaseEntity->getCode(),
                'source_id' => 'semantic_search',
            ],
        ]);
        $points = $knowledgeBaseEntity->getVectorDBDriver()->searchPoints(
            $knowledgeBaseEntity->getCollectionName(),
            $queryEmbeddings,
            $queryNum,
            $filter->getScore(),
            $filter->getMetadataFilter(),
        );
        foreach ($points as $point) {
            $fragment = KnowledgeBaseFragmentEntity::createByPointInfo($point, $knowledgeBaseEntity->getCode());
            $result[] = KnowledgeRetrievalResult::fromFragment((string) $fragment->getId(), $fragment->getContent(), $fragment->getBusinessId(), $fragment->getMetadata(), $fragment->getScore());
            if (count($result) >= $filter->getLimit()) {
                break;
            }
        }

        // todo 优化
        //        // 进行重排序
        //        if (count($result) > 1 && $retrieveConfig->isRerankingEnable() && container()->has(RerankGeneratorInterface::class)) {
        //            $rerankModelName = $retrieveConfig->getRerankingModel()["reranking_model_name'"];
        //            $rerankModel = OdinModelFactory::getFlowModelEntity($rerankModelName, $dataIsolation->getCurrentOrganizationCode());
        //            $documents = [];
        //            foreach ($result as $item) {
        //                $documents[] = $item->getContent();
        //            }
        //            $rerankGenerator = di(RerankGeneratorInterface::class);
        //            $rerankResult = $rerankGenerator->rerank($rerankModel->createRerank(), $filter->getQuestion(), $documents);
        //            // 按 relevance_score 从大到小排序
        //            usort($rerankResult, function ($a, $b) {
        //                return $b['relevance_score'] <=> $a['relevance_score'];
        //            });
        //
        //            // 根据排序后的结果重新排列 $result 数组
        //            $sortedResult = [];
        //            foreach ($rerankResult as $item) {
        //                $sortedResult[] = $result[$item['index']];
        //            }
        //            $result = $sortedResult;
        //            // 恢复到原始的 limit 值
        //            if (count($result) > $filter->getLimit()) {
        //                $result = array_slice($result, 0, $filter->getLimit());
        //            }
        //        }

        return $result;
    }
}
