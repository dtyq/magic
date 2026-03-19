<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Handler;

use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Dtyq\SuperMagic\Domain\RecycleBin\Repository\Facade\RecycleBinRepositoryInterface;
use Hyperf\DbConnection\Db;
use Throwable;

/**
 * 工作区彻底删除处理器.
 *
 * 当前仅删除回收站表记录；后续可在此处增加工作区及关联表的物理删除（与回收站删除同事务）。
 */
class WorkspacePermanentDeleteHandler implements PermanentDeleteHandlerInterface
{
    public function __construct(
        private readonly RecycleBinRepositoryInterface $recycleBinRepository
    ) {
    }

    public function supports(RecycleBinResourceType $type): bool
    {
        return $type === RecycleBinResourceType::Workspace;
    }

    public function handleBatch(array $recycleBinEntities): array
    {
        $failed = [];

        foreach ($recycleBinEntities as $entity) {
            try {
                Db::beginTransaction();

                // 后续可在此处增加：工作区表及关联表（如成员表等）的物理删除，与回收站删除同事务
                $this->recycleBinRepository->deleteById($entity->getId());

                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();

                $failed[] = [
                    'id' => (string) $entity->getId(),
                    'resource_type' => $entity->getResourceType()->value,
                    'resource_id' => (string) $entity->getResourceId(),
                    'resource_name' => $entity->getResourceName(),
                ];
            }
        }

        return ['failed' => $failed];
    }
}
