<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Factory;

use Dtyq\SuperMagic\Application\Share\Adapter\FileShareableResource;
use Dtyq\SuperMagic\Application\Share\Adapter\ProjectShareableResource;
use Dtyq\SuperMagic\Application\Share\Adapter\TopicShareableResource;
use Dtyq\SuperMagic\Application\Share\Factory\Facade\ResourceFactoryInterface;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use RuntimeException;

/**
 * 简单的资源工厂，根据资源类型返回对应的实现类实例.
 */
class ShareableResourceFactory
{
    /**
     * 根据资源类型创建对应的资源工厂实例.
     *
     * @param ResourceType $resourceType 资源类型
     * @return ResourceFactoryInterface 资源工厂接口实现
     * @throws RuntimeException 当资源类型不支持时抛出
     */
    public function create(ResourceType $resourceType): ResourceFactoryInterface
    {
        // 根据资源类型返回对应的实现
        $implementation = match ($resourceType) {
            ResourceType::Topic => TopicShareableResource::class,
            ResourceType::Project => ProjectShareableResource::class,
            ResourceType::File => FileShareableResource::class,
            // 可以添加更多资源类型的映射
            // ResourceType::Document => DocumentShareableResource::class,
            // ResourceType::Knowledge => KnowledgeShareableResource::class,
            default => null
        };

        if ($implementation === null) {
            throw new RuntimeException(
                sprintf('不支持的资源类型: %s', $resourceType->name)
            );
        }

        // 尝试通过容器获取实例
        return Di($implementation);
    }
}
