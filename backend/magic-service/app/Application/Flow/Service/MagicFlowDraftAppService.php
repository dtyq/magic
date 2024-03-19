<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowDraftQuery;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowDraftAppService extends AbstractFlowAppService
{
    /**
     * 查询草稿列表.
     * @return array{total: int, list: array<MagicFlowDraftEntity>, users: array}
     */
    public function queries(Authenticatable $authorization, MagicFLowDraftQuery $query, Page $page): array
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        if (empty($query->getFlowCode())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }

        $this->getFlowAndValidateOperation($dataIsolation, $query->getFlowCode(), 'read');

        $query->setSelect(['id', 'flow_code', 'code', 'name', 'description', 'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at']);
        $result = $this->magicFlowDraftDomainService->queries($dataIsolation, $query, $page);
        $userIds = [];
        foreach ($result['list'] as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
        }
        $result['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolation($dataIsolation), $userIds);
        return $result;
    }

    /**
     * 获取草稿详情.
     */
    public function show(Authenticatable $authorization, string $flowCode, string $draftCode): MagicFlowDraftEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $this->getFlowAndValidateOperation($dataIsolation, $flowCode, 'read');

        return $this->magicFlowDraftDomainService->show($dataIsolation, $flowCode, $draftCode);
    }

    /**
     * 删除草稿.
     */
    public function remove(Authenticatable $authorization, string $flowCode, string $draftCode): void
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $magicFlow = $this->getFlowAndValidateOperation($dataIsolation, $flowCode, 'edit');
        $this->magicFlowDraftDomainService->remove($dataIsolation, $magicFlow->getCode(), $draftCode);
    }

    /**
     * 保存草稿.
     */
    public function save(Authenticatable $authorization, MagicFlowDraftEntity $savingMagicFlowDraftEntity): MagicFlowDraftEntity
    {
        if (empty($savingMagicFlowDraftEntity->getFlowCode())) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $this->getFlowAndValidateOperation($dataIsolation, $savingMagicFlowDraftEntity->getFlowCode(), 'edit');

        return $this->magicFlowDraftDomainService->save($dataIsolation, $savingMagicFlowDraftEntity);
    }
}
