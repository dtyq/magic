<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Service;

use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseRemovedEvent;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseFragmentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\DbConnection\Annotation\Transactional;
use Psr\SimpleCache\CacheInterface;
use Psr\SimpleCache\InvalidArgumentException;

readonly class KnowledgeBaseDomainService
{
    public function __construct(
        private KnowledgeBaseRepositoryInterface $magicFlowKnowledgeRepository,
        private KnowledgeBaseFragmentRepositoryInterface $magicFlowKnowledgeFragmentRepository,
        private CacheInterface $cache,
    ) {
    }

    /**
     * 保存知识库 - 基本信息.
     */
    public function save(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $savingMagicFlowKnowledgeEntity): KnowledgeBaseEntity
    {
        $savingMagicFlowKnowledgeEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $savingMagicFlowKnowledgeEntity->setCreator($dataIsolation->getCurrentUserId());
        if ($savingMagicFlowKnowledgeEntity->shouldCreate()) {
            $savingMagicFlowKnowledgeEntity->prepareForCreation();
            $magicFlowKnowledgeEntity = $savingMagicFlowKnowledgeEntity;

            // 使用已经提前生成好的 code
            if (! empty($magicFlowKnowledgeEntity->getBusinessId())) {
                $tempCode = $this->getTempCodeByBusinessId($magicFlowKnowledgeEntity->getType(), $magicFlowKnowledgeEntity->getBusinessId());
                if (! empty($tempCode)) {
                    $magicFlowKnowledgeEntity->setCode($tempCode);
                }
            }
        } else {
            $magicFlowKnowledgeEntity = $this->magicFlowKnowledgeRepository->getByCode($dataIsolation, $savingMagicFlowKnowledgeEntity->getCode());
            if ($magicFlowKnowledgeEntity === null) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.common.not_found', ['label' => $savingMagicFlowKnowledgeEntity->getCode()]);
            }
            $savingMagicFlowKnowledgeEntity->prepareForModification($magicFlowKnowledgeEntity);
        }

        return $this->magicFlowKnowledgeRepository->save($dataIsolation, $magicFlowKnowledgeEntity);
    }

    /**
     * 查询知识库列表.
     * @return array{total: int, list: array<KnowledgeBaseEntity>}
     */
    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseQuery $query, Page $page): array
    {
        return $this->magicFlowKnowledgeRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * @return array<KnowledgeBaseEntity>
     */
    public function getByCodes(KnowledgeBaseDataIsolation $dataIsolation, array $codes): array
    {
        // 分批查询
        $chunks = array_chunk($codes, 500);
        $entities = [];
        foreach ($chunks as $chunk) {
            foreach ($this->magicFlowKnowledgeRepository->getByCodes($dataIsolation, $chunk) as $entity) {
                $entities[] = $entity;
            }
        }
        return $entities;
    }

    /**
     * 查询一个知识库.
     */
    public function show(KnowledgeBaseDataIsolation $dataIsolation, string $code, bool $checkCollection = false): KnowledgeBaseEntity
    {
        $magicFlowKnowledgeEntity = $this->magicFlowKnowledgeRepository->getByCode($dataIsolation, $code);
        if ($magicFlowKnowledgeEntity === null) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.common.not_found', ['label' => $code]);
        }
        if ($checkCollection) {
            $collection = $magicFlowKnowledgeEntity->getVectorDBDriver()->getCollection($magicFlowKnowledgeEntity->getCollectionName());
            if ($collection) {
                $magicFlowKnowledgeEntity->setCompletedCount($collection->pointsCount);
            }
            $query = new KnowledgeBaseFragmentQuery();
            $query->setKnowledgeCode($magicFlowKnowledgeEntity->getCode());
            $magicFlowKnowledgeEntity->setFragmentCount($this->magicFlowKnowledgeFragmentRepository->count($dataIsolation, $query));

            $query->setSyncStatus(KnowledgeSyncStatus::Synced->value);
            $magicFlowKnowledgeEntity->setExpectedCount($this->magicFlowKnowledgeFragmentRepository->count($dataIsolation, $query));
        }

        return $magicFlowKnowledgeEntity;
    }

    /**
     * 知识库是否存在.
     */
    public function exist(KnowledgeBaseDataIsolation $dataIsolation, string $code): bool
    {
        return $this->magicFlowKnowledgeRepository->exist($dataIsolation, $code);
    }

    /**
     * 删除知识库.
     */
    #[Transactional]
    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $magicFlowKnowledgeEntity): void
    {
        $this->magicFlowKnowledgeRepository->destroy($dataIsolation, $magicFlowKnowledgeEntity);
        $this->magicFlowKnowledgeFragmentRepository->destroyByKnowledgeCode($dataIsolation, $magicFlowKnowledgeEntity->getCode());
        AsyncEventUtil::dispatch(new KnowledgeBaseRemovedEvent($dataIsolation, $magicFlowKnowledgeEntity));
    }

    /**
     * 更新知识库状态
     */
    public function changeSyncStatus(KnowledgeBaseEntity|KnowledgeBaseFragmentEntity $entity): void
    {
        if ($entity instanceof KnowledgeBaseEntity) {
            $this->magicFlowKnowledgeRepository->changeSyncStatus($entity);
        }
        if ($entity instanceof KnowledgeBaseFragmentEntity) {
            $this->magicFlowKnowledgeFragmentRepository->changeSyncStatus($entity);
        }
    }

    public function generateTempCodeByBusinessId(int $knowledgeType, string $businessId): string
    {
        $key = 'knowledge-code:generate:' . $knowledgeType . ':' . $businessId;
        try {
            if ($this->cache->has($key)) {
                return (string) $this->cache->get($key, '');
            }
            $code = Code::Knowledge->gen();
            $this->cache->set($key, $code, 7 * 24 * 60 * 60);
            return $code;
        } catch (InvalidArgumentException) {
            return Code::Knowledge->gen();
        }
    }

    public function getTempCodeByBusinessId(int $knowledgeType, string $businessId): string
    {
        $key = 'knowledge-code:generate:' . $knowledgeType . ':' . $businessId;
        try {
            $value = $this->cache->get($key, '');
            $this->cache->delete($key);
            return (string) $value;
        } catch (InvalidArgumentException) {
            return '';
        }
    }
}
