<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Service\VideoBillingDetailsResolver;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoBillingDetailsResolverTest extends TestCase
{
    public function testResolveFromMetadataMapsLandscapeDimensionsToPresetResolution(): void
    {
        $resolver = new VideoBillingDetailsResolver();

        $billingDetails = $resolver->resolveFromMetadata(new VideoMediaMetadata(8.02, 1920, 1080));

        $this->assertSame(8, $billingDetails['duration_seconds']);
        $this->assertSame('1080p', $billingDetails['resolution']);
        $this->assertSame('1920x1080', $billingDetails['size']);
        $this->assertSame(1920, $billingDetails['width']);
        $this->assertSame(1080, $billingDetails['height']);
    }

    public function testResolveFromMetadataMapsPortraitDimensionsToPresetResolution(): void
    {
        $resolver = new VideoBillingDetailsResolver();

        $billingDetails = $resolver->resolveFromMetadata(new VideoMediaMetadata(7.96, 1080, 1920));

        $this->assertSame(8, $billingDetails['duration_seconds']);
        $this->assertSame('1080p', $billingDetails['resolution']);
        $this->assertSame('1080x1920', $billingDetails['size']);
        $this->assertSame(1080, $billingDetails['width']);
        $this->assertSame(1920, $billingDetails['height']);
    }

    public function testResolveFromMetadataKeepsNonPresetDimensionsWithoutResolution(): void
    {
        $resolver = new VideoBillingDetailsResolver();

        $billingDetails = $resolver->resolveFromMetadata(new VideoMediaMetadata(8.11, 1536, 864));

        $this->assertSame(9, $billingDetails['duration_seconds']);
        $this->assertNull($billingDetails['resolution']);
        $this->assertSame('1536x864', $billingDetails['size']);
        $this->assertSame(1536, $billingDetails['width']);
        $this->assertSame(864, $billingDetails['height']);
    }
}
