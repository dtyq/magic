<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\FileCollection\Repository\Facade;

use Dtyq\SuperMagic\Domain\FileCollection\Entity\FileCollectionEntity;

/**
 * 文件集仓储接口.
 */
interface FileCollectionRepositoryInterface
{
    /**
     * 通过ID获取文件集.
     *
     * @param int $id 文件集ID
     * @return null|FileCollectionEntity 文件集实体
     */
    public function getById(int $id): ?FileCollectionEntity;

    /**
     * 保存文件集实体.
     *
     * @param FileCollectionEntity $entity 文件集实体
     * @return FileCollectionEntity 保存后的实体
     */
    public function save(FileCollectionEntity $entity): FileCollectionEntity;

    /**
     * 删除文件集.
     *
     * @param int $id 文件集ID
     * @param bool $forceDelete 是否强制删除（物理删除），默认false为软删除
     * @return bool 是否成功
     */
    public function delete(int $id, bool $forceDelete = false): bool;
}
