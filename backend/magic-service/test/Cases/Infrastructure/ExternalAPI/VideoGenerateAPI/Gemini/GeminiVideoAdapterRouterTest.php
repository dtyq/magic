<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiOmni1FlashVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability\GeminiOmniGenerationCapabilityProvider;
use PHPUnit\Framework\TestCase;

/** @internal */
final class GeminiVideoAdapterRouterTest extends TestCase
{
    public function testUnknownModelThrowsRuntimeException(): void
    {
        $router = new GeminiVideoAdapterRouter(new GeminiOmni1FlashVideoAdapter(new GeminiOmniGenerationCapabilityProvider(), new GeminiFakeTransport()));
        self::assertFalse($router->supportsModel('unknown', ''));
    }
}
