<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\ImageOperation;

use App\Application\ModelGateway\Processor\WatermarkProcessor;
use App\Application\ModelGateway\Struct\ImagePostProcessOptions;
use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class WatermarkProcessorTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testProcessAppliesWatermarkWhenWatermarkWorkExists(): void
    {
        $watermarkProcessor = Mockery::mock(ImageWatermarkProcessor::class);
        $processor = new WatermarkProcessor($watermarkProcessor);

        $context = new ImageProcessContext(
            localFilePath: '/tmp/provider-result.png',
            mimeType: 'image/png',
            provider: 'official_proxy',
        );
        $options = new ImagePostProcessOptions();
        $options->setImplicitWatermark(new ImplicitWatermark());
        $context->setPostProcessOptions($options);

        $watermarkProcessor->shouldReceive('processLocalFile')
            ->once()
            ->with('/tmp/provider-result.png', null, Mockery::type(ImplicitWatermark::class));

        $processor->process($context);

        $this->assertSame('/tmp/provider-result.png', $context->getLocalFilePath());
    }
}
