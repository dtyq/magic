<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionNamedType;

/** @internal */
final class VideoGenerateFactoryTest extends TestCase
{
    public function testGeminiRouterIsRequiredDependency(): void
    {
        $constructor = (new ReflectionClass(VideoGenerateFactory::class))->getConstructor();
        $parameters = $constructor?->getParameters() ?? [];
        $geminiParameter = null;

        foreach ($parameters as $parameter) {
            $type = $parameter->getType();
            if ($type instanceof ReflectionNamedType && $type->getName() === GeminiVideoAdapterRouter::class) {
                $geminiParameter = $parameter;
                break;
            }
        }

        self::assertNotNull($geminiParameter);
        self::assertFalse($geminiParameter->allowsNull());
        self::assertFalse($geminiParameter->isDefaultValueAvailable());
    }
}
