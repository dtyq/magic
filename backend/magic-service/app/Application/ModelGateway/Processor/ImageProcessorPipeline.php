<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use Psr\Container\ContainerInterface;

final class ImageProcessorPipeline
{
    public function __construct(
        private readonly ContainerInterface $container,
    ) {
    }

    /**
     * @param array<class-string<ImageProcessorInterface>|ImageProcessorInterface> $processors
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
