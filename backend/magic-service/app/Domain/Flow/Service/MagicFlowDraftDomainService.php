<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowDraftQuery;
use App\Domain\Flow\Repository\Facade\MagicFlowDraftRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Annotation\Transactional;

class MagicFlowDraftDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowDraftRepositoryInterface $magicFlowDraftRepository,
    ) {
    }

    /**
     * 查询草稿列表.
     * @return array{total: int, list: array<MagicFlowDraftEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowDraftQuery $query, Page $page): array
    {
        return $this->magicFlowDraftRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 获取草稿详情.
     */
    public function show(FlowDataIsolation $dataIsolation, string $flowCode, string $draftCode): MagicFlowDraftEntity
    {
        $draft = $this->magicFlowDraftRepository->getByFlowCodeAndCode($dataIsolation, $flowCode, $draftCode);
        if (! $draft) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$draftCode} 不存在");
        }
        return $draft;
    }

    /**
     * 删除草稿.
     */
    public function remove(FlowDataIsolation $dataIsolation, string $flowCode, string $draftCode): void
    {
        $draft = $this->magicFlowDraftRepository->getByFlowCodeAndCode($dataIsolation, $flowCode, $draftCode);
        if (! $draft) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$draftCode} 不存在");
        }
        $this->magicFlowDraftRepository->remove($dataIsolation, $draft);
    }

    /**
     * 保存草稿.
     */
    #[Transactional]
    public function save(FlowDataIsolation $dataIsolation, MagicFlowDraftEntity $savingMagicFlowDraftEntity): MagicFlowDraftEntity
    {
        $savingMagicFlowDraftEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingMagicFlowDraftEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingMagicFlowDraftEntity->shouldCreate()) {
            $magicFlowDraftEntity = clone $savingMagicFlowDraftEntity;
            $magicFlowDraftEntity->prepareForCreation();
        } else {
            if (empty($savingMagicFlowDraftEntity->getCode())) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'code 不能为空');
            }
            $magicFlowDraftEntity = $this->magicFlowDraftRepository->getByFlowCodeAndCode($dataIsolation, $savingMagicFlowDraftEntity->getFlowCode(), $savingMagicFlowDraftEntity->getCode());
            if (! $magicFlowDraftEntity) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$savingMagicFlowDraftEntity->getCode()} 不存在");
            }
            $savingMagicFlowDraftEntity->prepareForModification($magicFlowDraftEntity);
        }

        $draft = $this->magicFlowDraftRepository->save($dataIsolation, $magicFlowDraftEntity);
        // 仅保留最新的记录
        $this->magicFlowDraftRepository->clearEarlyRecords($dataIsolation, $savingMagicFlowDraftEntity->getFlowCode());
        return $draft;
    }
}
