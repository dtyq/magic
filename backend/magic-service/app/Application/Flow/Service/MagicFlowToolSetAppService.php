<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\DbConnection\Annotation\Transactional;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowToolSetAppService extends AbstractFlowAppService
{
    public function getByCode(Authenticatable $authorization, string $code): MagicFlowToolSetEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $operation = $this->operationPermissionAppService->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            $code,
            $authorization->getId()
        );
        if (! $operation->canRead()) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'common.access', ['label' => $code]);
        }

        $toolSet = $this->magicFlowToolSetDomainService->getByCode($dataIsolation, $code);
        $toolSet->setUserOperation($operation->value);
        return $toolSet;
    }

    #[Transactional]
    public function save(Authenticatable $authorization, MagicFlowToolSetEntity $savingMagicFLowToolSetEntity): MagicFlowToolSetEntity
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);

        // 默认是创建
        $operation = Operation::Owner;
        if (! $savingMagicFLowToolSetEntity->shouldCreate()) {
            // 修改需要检查权限
            $operation = $this->operationPermissionAppService->getOperationByResourceAndUser(
                $permissionDataIsolation,
                ResourceType::ToolSet,
                $savingMagicFLowToolSetEntity->getCode(),
                $authorization->getId()
            );
            if (! $operation->canEdit()) {
                ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'common.access', ['label' => $savingMagicFLowToolSetEntity->getCode()]);
            }
        }

        $toolSet = $this->magicFlowToolSetDomainService->save($dataIsolation, $savingMagicFLowToolSetEntity);
        $toolSet->setUserOperation($operation->value);
        return $toolSet;
    }

    /**
     * @return array{total: int, list: array<MagicFlowToolSetEntity>, icons: array<string,FileLink>}
     */
    public function queries(Authenticatable $authorization, MagicFlowToolSetQuery $query, Page $page): array
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = PermissionDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());

        // 仅查询目前用户具有权限的工具集
        $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            [$authorization->getId()]
        )[$authorization->getId()] ?? [];
        $resourceIds = array_keys($resources);

        // 其实不太适合的 whereIn 暂时没想到其他好办法
        $query->setCodes($resourceIds);

        $data = $this->magicFlowToolSetDomainService->queries($dataIsolation, $query, $page);
        $filePaths = [];
        foreach ($data['list'] ?? [] as $item) {
            $filePaths[] = $item->getIcon();
            if ($item->getCode() === ConstValue::TOOL_SET_DEFAULT_CODE) {
                // 未分组的直接分配管理员权限
                $item->setUserOperation(Operation::Admin->value);
            } else {
                $operation = $resources[$item->getCode()] ?? Operation::None;
                $item->setUserOperation($operation->value);
            }
        }
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $filePaths);
        return $data;
    }

    public function destroy(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $operation = $this->operationPermissionAppService->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            $code,
            $authorization->getId()
        );
        if (! $operation->canDelete()) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'common.access', ['label' => $code]);
        }
        $this->magicFlowToolSetDomainService->destroy($dataIsolation, $code);
    }
}
