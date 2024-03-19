<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Service;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentMode;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseFragmentRemovedEvent;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseFragmentSavedEvent;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseDocumentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseFragmentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Odin\TextSplitter\TokenTextSplitter;
use App\Infrastructure\Util\Text\TextPreprocess\TextPreprocessUtil;
use App\Infrastructure\Util\Text\TextPreprocess\ValueObject\TextPreprocessRule;
use App\Infrastructure\Util\Time\TimeUtil;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Exception;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

readonly class KnowledgeBaseFragmentDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private KnowledgeBaseFragmentRepositoryInterface $knowledgeBaseFragmentRepository,
        private KnowledgeBaseRepositoryInterface $knowledgeBaseRepository,
        private KnowledgeBaseDocumentRepositoryInterface $knowledgeBaseDocumentRepository,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * @return array{total: int, list: array<KnowledgeBaseFragmentEntity>}
     */
    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentQuery $query, Page $page): array
    {
        return $this->knowledgeBaseFragmentRepository->queries($dataIsolation, $query, $page);
    }

    public function show(KnowledgeBaseDataIsolation $dataIsolation, int $id, bool $selectForUpdate = false, bool $throw = true): ?KnowledgeBaseFragmentEntity
    {
        $magicFlowKnowledgeFragmentEntity = $this->knowledgeBaseFragmentRepository->getById($dataIsolation, $id, $selectForUpdate);
        if (empty($magicFlowKnowledgeFragmentEntity) && $throw) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, "[{$id}] 不存在");
        }
        return $magicFlowKnowledgeFragmentEntity;
    }

    public function save(
        KnowledgeBaseDataIsolation $dataIsolation,
        KnowledgeBaseEntity $knowledgeBaseEntity,
        KnowledgeBaseDocumentEntity $knowledgeBaseDocumentEntity,
        KnowledgeBaseFragmentEntity $savingMagicFlowKnowledgeFragmentEntity
    ): KnowledgeBaseFragmentEntity {
        $savingMagicFlowKnowledgeFragmentEntity->setKnowledgeCode($knowledgeBaseEntity->getCode());
        $savingMagicFlowKnowledgeFragmentEntity->setDocumentCode($knowledgeBaseDocumentEntity->getCode());
        $savingMagicFlowKnowledgeFragmentEntity->setCreator($dataIsolation->getCurrentUserId());

        // 如果有业务id，并且业务 ID 存在，也可以相当于更新
        $knowledgeBaseFragmentEntity = null;
        if (! empty($savingMagicFlowKnowledgeFragmentEntity->getBusinessId()) && empty($savingMagicFlowKnowledgeFragmentEntity->getId())) {
            $knowledgeBaseFragmentEntity = $this->knowledgeBaseFragmentRepository->getByBusinessId($dataIsolation, $savingMagicFlowKnowledgeFragmentEntity->getKnowledgeCode(), $savingMagicFlowKnowledgeFragmentEntity->getBusinessId());
            if (! is_null($knowledgeBaseFragmentEntity)) {
                $savingMagicFlowKnowledgeFragmentEntity->setId($knowledgeBaseFragmentEntity->getId());
            }
        }

        if ($savingMagicFlowKnowledgeFragmentEntity->shouldCreate()) {
            $savingMagicFlowKnowledgeFragmentEntity->prepareForCreation();
            $knowledgeBaseFragmentEntity = $savingMagicFlowKnowledgeFragmentEntity;
        } else {
            $knowledgeBaseFragmentEntity = $knowledgeBaseFragmentEntity ?? $this->knowledgeBaseFragmentRepository->getById($dataIsolation, $savingMagicFlowKnowledgeFragmentEntity->getId());
            if (empty($knowledgeBaseFragmentEntity)) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, "[{$savingMagicFlowKnowledgeFragmentEntity->getId()}] 没有找到");
            }
            // 如果没有变化，就不需要更新了
            if (! $knowledgeBaseFragmentEntity->hasModify($savingMagicFlowKnowledgeFragmentEntity)) {
                return $knowledgeBaseFragmentEntity;
            }

            $savingMagicFlowKnowledgeFragmentEntity->prepareForModification($knowledgeBaseFragmentEntity);
        }

        Db::transaction(function () use ($dataIsolation, $knowledgeBaseFragmentEntity) {
            $oldKnowledgeBaseFragmentEntity = $this->knowledgeBaseFragmentRepository->getById($dataIsolation, $knowledgeBaseFragmentEntity->getId() ?? 0, true);
            $knowledgeBaseFragmentEntity = $this->knowledgeBaseFragmentRepository->save($dataIsolation, $knowledgeBaseFragmentEntity);
            $deltaWordCount = $knowledgeBaseFragmentEntity->getWordCount() - $oldKnowledgeBaseFragmentEntity?->getWordCount() ?? 0;
            $this->updateWordCount($dataIsolation, $knowledgeBaseFragmentEntity, $deltaWordCount);
        });

        $event = new KnowledgeBaseFragmentSavedEvent($dataIsolation, $knowledgeBaseEntity, $knowledgeBaseFragmentEntity);
        AsyncEventUtil::dispatch($event);

        return $knowledgeBaseFragmentEntity;
    }

    /**
     * @param array<KnowledgeBaseFragmentEntity> $fragmentEntities
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public function upsert(KnowledgeBaseDataIsolation $dataIsolation, array $fragmentEntities): array
    {
        $this->knowledgeBaseFragmentRepository->upsertById($dataIsolation, $fragmentEntities);
        return $fragmentEntities;
    }

    public function showByBusinessId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $businessId): KnowledgeBaseFragmentEntity
    {
        $magicFlowKnowledgeFragmentEntity = $this->knowledgeBaseFragmentRepository->getByBusinessId($dataIsolation, $knowledgeCode, $businessId);
        if (empty($magicFlowKnowledgeFragmentEntity)) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, "[{$businessId}] 不存在");
        }
        return $magicFlowKnowledgeFragmentEntity;
    }

    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $knowledgeBaseEntity, KnowledgeBaseFragmentEntity $knowledgeBaseFragmentEntity): void
    {
        Db::transaction(function () use ($dataIsolation, $knowledgeBaseFragmentEntity) {
            $oldKnowledgeBaseFragmentEntity = $this->knowledgeBaseFragmentRepository->getById($dataIsolation, $knowledgeBaseFragmentEntity->getId(), true);
            $this->knowledgeBaseFragmentRepository->destroy($dataIsolation, $knowledgeBaseFragmentEntity);
            // 需要更新字符数
            $deltaWordCount = -$oldKnowledgeBaseFragmentEntity->getWordCount();
            $this->updateWordCount($dataIsolation, $oldKnowledgeBaseFragmentEntity, $deltaWordCount);
        });

        AsyncEventUtil::dispatch(new KnowledgeBaseFragmentRemovedEvent($dataIsolation, $knowledgeBaseEntity, $knowledgeBaseFragmentEntity));
    }

    public function batchDestroyByPointIds(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseEntity $knowledgeEntity, array $pointIds): void
    {
        $this->knowledgeBaseFragmentRepository->fragmentBatchDestroyByPointIds($dataIsolation, $knowledgeEntity->getCode(), $pointIds);
    }

    /**
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public function getByIds(KnowledgeBaseDataIsolation $dataIsolation, array $ids): array
    {
        return $this->knowledgeBaseFragmentRepository->getByIds($dataIsolation, $ids);
    }

    /**
     * 根据 point_id 获取所有相关片段，按 version 倒序排序.
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public function getFragmentsByPointId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $pointId, bool $lock = false): array
    {
        return $this->knowledgeBaseFragmentRepository->getFragmentsByPointId($dataIsolation, $knowledgeCode, $pointId, $lock);
    }

    /**
     * @return array<string, KnowledgeSyncStatus>
     */
    public function getFinalSyncStatusByDocumentCodes(KnowledgeBaseDataIsolation $dataIsolation, array $documentCodes): array
    {
        return $this->knowledgeBaseFragmentRepository->getFinalSyncStatusByDocumentCodes($dataIsolation, $documentCodes);
    }

    /**
     * 更新知识库片段状态.
     */
    public function batchChangeSyncStatus(array $ids, KnowledgeSyncStatus $syncStatus, string $syncMessage = ''): void
    {
        $this->knowledgeBaseFragmentRepository->batchChangeSyncStatus($ids, $syncStatus, $syncMessage);
    }

    /**
     * @return array<string>
     * @throws Exception
     */
    public function processFragmentsByContent(KnowledgeBaseDataIsolation $dataIsolation, string $content, FragmentConfig $fragmentConfig): array
    {
        $selectedFragmentConfig = match ($fragmentConfig->getMode()) {
            FragmentMode::NORMAL => $fragmentConfig->getNormal(),
            FragmentMode::PARENT_CHILD => $fragmentConfig->getParentChild(),
            default => ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed),
        };
        $preprocessRule = $selectedFragmentConfig->getTextPreprocessRule();
        // 先进行预处理
        // 需要过滤REPLACE_WHITESPACE规则，REPLACE_WHITESPACE规则在分段后进行处理
        $filterPreprocessRule = array_filter($preprocessRule, fn (TextPreprocessRule $rule) => $rule !== TextPreprocessRule::REPLACE_WHITESPACE);
        $start = microtime(true);
        $this->logger->info('前置文本预处理开始。');
        $content = TextPreprocessUtil::preprocess($filterPreprocessRule, $content);
        $this->logger->info('前置文本预处理结束，耗时:' . TimeUtil::getMillisecondDiffFromNow($start) / 1000);

        // 再进行分段
        // 处理转义的分隔符
        $start = microtime(true);
        $this->logger->info('文本分段开始。');
        $separator = stripcslashes($selectedFragmentConfig->getSegmentRule()->getSeparator());
        $splitter = new TokenTextSplitter(
            chunkSize: $selectedFragmentConfig->getSegmentRule()->getChunkSize(),
            chunkOverlap: $selectedFragmentConfig->getSegmentRule()->getChunkOverlap(),
            fixedSeparator: $separator,
            preserveSeparator: true,
        );

        $fragments = $splitter->splitText($content);
        $this->logger->info('文本分段结束，耗时:' . TimeUtil::getMillisecondDiffFromNow($start) / 1000);

        // 需要额外进行处理的规则
        $start = microtime(true);
        $this->logger->info('后置文本预处理开始。');
        if (in_array(TextPreprocessRule::REPLACE_WHITESPACE, $preprocessRule)) {
            foreach ($fragments as &$fragment) {
                $fragment = TextPreprocessUtil::preprocess([TextPreprocessRule::REPLACE_WHITESPACE], $fragment);
            }
        }
        $this->logger->info('后置文本预处理结束，耗时:' . TimeUtil::getMillisecondDiffFromNow($start) / 1000);

        // 过滤掉空字符串
        return array_values(array_filter($fragments, function ($fragment) {
            return trim($fragment) !== '';
        }));
    }

    /**
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public function getFragmentsWithEmptyDocumentCode(KnowledgeBaseDataIsolation $dataIsolation, ?int $lastId = null, int $pageSize = 500): array
    {
        return $this->knowledgeBaseFragmentRepository->getFragmentsByEmptyDocumentCode($dataIsolation, $lastId, $pageSize);
    }

    #[Transactional]
    public function updateWordCount(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentEntity $entity, int $deltaWordCount): void
    {
        // 更新数据库字数统计
        $this->knowledgeBaseRepository->updateWordCount($dataIsolation, $entity->getKnowledgeCode(), $deltaWordCount);
        // 更新文档字数统计
        $this->knowledgeBaseDocumentRepository->updateWordCount($dataIsolation, $entity->getKnowledgeCode(), $entity->getDocumentCode(), $deltaWordCount);
    }
}
