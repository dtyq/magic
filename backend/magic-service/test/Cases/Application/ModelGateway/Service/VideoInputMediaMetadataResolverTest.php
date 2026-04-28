<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\Video\VideoInputMediaMetadataResolver;
use App\Application\ModelGateway\Service\VideoOperationAppService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionNamedType;

/**
 * @internal
 */
class VideoInputMediaMetadataResolverTest extends TestCase
{
    public function testResolverAndAppServiceReturnArrayMetadata(): void
    {
        $resolverReturnType = (new ReflectionMethod(VideoInputMediaMetadataResolver::class, 'resolve'))->getReturnType();
        $appServiceReturnType = (new ReflectionMethod(VideoOperationAppService::class, 'resolveEstimateInputMetadata'))->getReturnType();

        $this->assertInstanceOf(ReflectionNamedType::class, $resolverReturnType);
        $this->assertSame('array', $resolverReturnType->getName());
        $this->assertInstanceOf(ReflectionNamedType::class, $appServiceReturnType);
        $this->assertSame('array', $appServiceReturnType->getName());
    }
}
