<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\MagicFlowVersionEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Domain\Flow\Event\MagicFlowPublishedEvent;
use App\Domain\Flow\Repository\Facade\MagicFlowRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowVersionRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\DbConnection\Annotation\Transactional;

class MagicFlowVersionDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowRepositoryInterface $magicFlowRepository,
        private readonly MagicFlowVersionRepositoryInterface $magicFlowVersionRepository,
    ) {
    }

    /**
     * @return array<MagicFlowVersionEntity>
     */
    public function getByCodes(FlowDataIsolation $dataIsolation, array $versionCodes): array
    {
        return $this->magicFlowVersionRepository->getByCodes($dataIsolation, $versionCodes);
    }

    public function getLastVersion(FlowDataIsolation $dataIsolation, string $flowCode): ?MagicFlowVersionEntity
    {
        return $this->magicFlowVersionRepository->getLastVersion($dataIsolation, $flowCode);
    }

    /**
     * 查询版本列表.
     * @return array{total: int, list: array<MagicFlowVersionEntity>}
     */
    public function queries(FlowDataIsolation $dataIsolation, MagicFLowVersionQuery $query, Page $page): array
    {
        return $this->magicFlowVersionRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 获取版本详情.
     */
    public function show(FlowDataIsolation $dataIsolation, string $flowCode, string $versionCode): MagicFlowVersionEntity
    {
        $version = $this->magicFlowVersionRepository->getByFlowCodeAndCode($dataIsolation, $flowCode, $versionCode);
        if (! $version) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$versionCode} 不存在");
        }
        return $version;
    }

    /**
     * 发版.
     */
    #[Transactional]
    public function publish(FlowDataIsolation $dataIsolation, MagicFlowEntity $magicFlow, MagicFlowVersionEntity $magicFlowVersionEntity): MagicFlowVersionEntity
    {
        $magicFlowVersionEntity->setCreator($dataIsolation->getCurrentUserId());
        $magicFlowVersionEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $magicFlowVersionEntity->prepareForCreation();
        if (empty($magicFlow->getVersionCode())) {
            $magicFlow->setEnabled(true);
            $magicFlowVersionEntity->getMagicFlow()->setEnabled(true);
        }
        $magicFlow->prepareForPublish($magicFlowVersionEntity, $dataIsolation->getCurrentUserId());

        $magicFlowVersionEntity = $this->magicFlowVersionRepository->create($dataIsolation, $magicFlowVersionEntity);
        $this->magicFlowRepository->save($dataIsolation, $magicFlow);
        AsyncEventUtil::dispatch(new MagicFlowPublishedEvent($magicFlowVersionEntity->getMagicFlow()));
        return $magicFlowVersionEntity;
    }

    /**
     * 回滚版本.
     */
    public function rollback(FlowDataIsolation $dataIsolation, MagicFlowEntity $magicFlow, string $versionCode): MagicFlowVersionEntity
    {
        $version = $this->magicFlowVersionRepository->getByFlowCodeAndCode($dataIsolation, $magicFlow->getCode(), $versionCode);
        if (! $version) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "{$versionCode} 不存在");
        }

        $magicFlow->prepareForPublish($version, $dataIsolation->getCurrentUserId());
        $this->magicFlowRepository->save($dataIsolation, $magicFlow);
        AsyncEventUtil::dispatch(new MagicFlowPublishedEvent($magicFlow));
        return $version;
    }

    public function existVersion(FlowDataIsolation $dataIsolation, string $flowCode): bool
    {
        return $this->magicFlowVersionRepository->existVersion($dataIsolation, $flowCode);
    }
}
