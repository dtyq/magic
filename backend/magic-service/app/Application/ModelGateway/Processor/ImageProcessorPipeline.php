<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use Psr\Container\ContainerInterface;

/**
 * 顺序执行图片处理步骤。
 * 管线本身不关心具体处理内容，只负责组织执行顺序和传递同一个上下文。
 */
final class ImageProcessorPipeline
{
    public function __construct(
        private readonly ContainerInterface $container,
    ) {
    }

    /**
     * @param array<class-string<ImageProcessorInterface>|ImageProcessorInterface> $processors
     *                                                                                         允许传入类名或实例，便于在业务侧按需拼装处理链
     */
    public function process(ImageProcessContext $context, array $processors): ImageProcessContext
    {
        foreach ($processors as $processor) {
            if (is_string($processor)) {
                $processor = $this->container->get($processor);
            }
            $processor->process($context);
        }

        return $context;
    }
}
