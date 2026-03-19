<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Handler;

use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;

/**
 * 彻底删除处理器接口.
 */
interface PermanentDeleteHandlerInterface
{
    /**
     * 是否支持该资源类型.
     */
    public function supports(RecycleBinResourceType $type): bool;

    /**
     * 批量处理该类型的回收站记录.
     *
     * @param array $recycleBinEntities RecycleBinEntity[] 该类型的回收站实体列表
     * @return array ['failed' => [...]] 只返回失败项，每项含 id、resource_type、resource_id、resource_name
     */
    public function handleBatch(array $recycleBinEntities): array;
}
