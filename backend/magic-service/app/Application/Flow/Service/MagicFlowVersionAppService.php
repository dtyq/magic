<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowVersionEntity;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowVersionAppService extends AbstractFlowAppService
{
    /**
     * 查询版本列表.
     * @return array{total: int, list: array<MagicFlowVersionEntity>, users: array}
     */
    public function queries(Authenticatable $authorization, MagicFLowVersionQuery $query, Page $page): array
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        if (empty($query->getFlowCode())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }

        $this->getFlowAndValidateOperation($dataIsolation, $query->getFlowCode(), 'read');

        $query->setSelect(['id', 'flow_code', 'code', 'name', 'description', 'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at']);
        $result = $this->magicFlowVersionDomainService->queries($dataIsolation, $query, $page);
        $userIds = [];
        foreach ($result['list'] as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
        }
        $result['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolation($dataIsolation), $userIds);
        return $result;
    }

    /**
     * 获取版本详情.
     */
    public function show(Authenticatable $authorization, string $flowCode, string $versionCode): MagicFlowVersionEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        if (empty($flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        $magicFlow = $this->getFlowAndValidateOperation($dataIsolation, $flowCode, 'read');
        $version = $this->magicFlowVersionDomainService->show($dataIsolation, $magicFlow->getCode(), $versionCode);
        $version->getMagicFlow()->setUserOperation($magicFlow->getUserOperation());
        return $version;
    }

    /**
     * 发布版本.
     */
    public function publish(Authenticatable $authorization, MagicFlowVersionEntity $magicFlowVersionEntity): MagicFlowVersionEntity
    {
        if (empty($magicFlowVersionEntity->getFlowCode())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $magicFlow = $this->getFlowAndValidateOperation($dataIsolation, $magicFlowVersionEntity->getFlowCode(), 'edit');

        $version = $this->magicFlowVersionDomainService->publish($dataIsolation, $magicFlow, $magicFlowVersionEntity);
        $version->getMagicFlow()->setUserOperation($magicFlow->getUserOperation());
        return $version;
    }

    /**
     * 回滚版本.
     */
    public function rollback(Authenticatable $authorization, string $flowCode, string $versionCode): MagicFlowVersionEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        if (empty($flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        $magicFlow = $this->getFlowAndValidateOperation($dataIsolation, $flowCode, 'edit');

        $version = $this->magicFlowVersionDomainService->rollback($dataIsolation, $magicFlow, $versionCode);
        $version->getMagicFlow()->setUserOperation($magicFlow->getUserOperation());
        return $version;
    }
}
