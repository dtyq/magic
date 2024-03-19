<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowTriggerTestcaseEntity;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowTriggerTestcaseQuery;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowTriggerTestcaseAppService extends AbstractFlowAppService
{
    /**
     * 保存触发测试集.
     */
    public function save(Authenticatable $authorization, MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): MagicFlowTriggerTestcaseEntity
    {
        return $this->magicFlowTriggerTestcaseDomainService->save($this->createFlowDataIsolation($authorization), $magicFlowTriggerTestcaseEntity);
    }

    /**
     * 获取触发测试集.
     */
    public function show(Authenticatable $authorization, string $flowCode, string $testcaseCode): MagicFlowTriggerTestcaseEntity
    {
        return $this->magicFlowTriggerTestcaseDomainService->show($this->createFlowDataIsolation($authorization), $flowCode, $testcaseCode);
    }

    /**
     * 删除触发测试集.
     */
    public function remove(Authenticatable $authorization, string $flowCode, string $testcaseCode): void
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $testcaseEntity = $this->magicFlowTriggerTestcaseDomainService->show($dataIsolation, $flowCode, $testcaseCode);
        $this->magicFlowTriggerTestcaseDomainService->remove($dataIsolation, $testcaseEntity);
    }

    /**
     * 查询触发测试集.
     * @return array{total: int, list: array<MagicFlowTriggerTestcaseEntity>, users: array}
     */
    public function queries(Authenticatable $authorization, MagicFLowTriggerTestcaseQuery $query, Page $page): array
    {
        $result = $this->magicFlowTriggerTestcaseDomainService->queries($this->createFlowDataIsolation($authorization), $query, $page);
        $userIds = [];
        foreach ($result['list'] as $item) {
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
        }
        $result['users'] = $this->magicUserDomainService->getByUserIds($this->createContactDataIsolation($this->createFlowDataIsolation($authorization)), $userIds);
        return $result;
    }
}
