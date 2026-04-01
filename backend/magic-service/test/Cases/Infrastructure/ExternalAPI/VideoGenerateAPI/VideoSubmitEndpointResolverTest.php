<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoSubmitEndpointResolver;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoSubmitEndpointResolverTest extends TestCase
{
    public function testResolvePrefixesAsyncVideoEndpoint(): void
    {
        $this->assertSame('/api/async/video_veo3.1_fast', VideoSubmitEndpointResolver::resolve('veo3.1_fast'));
        $this->assertSame('/api/async/video_veo3.1_pro', VideoSubmitEndpointResolver::resolve('veo3.1_pro'));
        $this->assertSame('/api/async/video_grok_imagine', VideoSubmitEndpointResolver::resolve('grok_imagine'));
        $this->assertSame('/api/async/video_seedance', VideoSubmitEndpointResolver::resolve('video_seedance'));
        $this->assertSame('/api/async/video_custom', VideoSubmitEndpointResolver::resolve('api/async/video_custom'));
        $this->assertSame('/api/async/video_custom', VideoSubmitEndpointResolver::resolve('/api/async/video_custom'));
    }
}
