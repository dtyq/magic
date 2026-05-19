<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\ImageOperation;

use App\Application\ModelGateway\Processor\ImageProcessorInterface;
use App\Application\ModelGateway\Processor\ImageProcessorPipeline;
use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ExternalAPI\Image\ImageAsset;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class ImageProcessorPipelineTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testProcessRunsProcessorsInOrderOnSameContext(): void
    {
        $context = new ImageProcessContext(
            asset: ImageAsset::fromLocalFile('/tmp/provider-result.png', 'image/png', 'official_proxy'),
            localFilePath: '/tmp/provider-result.png',
        );

        $firstProcessor = Mockery::mock(ImageProcessorInterface::class);
        $secondProcessor = Mockery::mock(ImageProcessorInterface::class);
        $container = Mockery::mock(ContainerInterface::class);

        $sequence = [];

        $firstProcessor->shouldReceive('process')
            ->once()
            ->with($context)
            ->andReturnUsing(static function (ImageProcessContext $context) use (&$sequence): void {
                $sequence[] = 'first';
                $context->setUploadedUrl('https://cdn.example.com/intermediate.png');
            });

        $secondProcessor->shouldReceive('process')
            ->once()
            ->with($context)
            ->andReturnUsing(static function (ImageProcessContext $context) use (&$sequence): void {
                $sequence[] = 'second';
                $context->setUploadedUrl('https://cdn.example.com/final.png');
            });

        $container->shouldReceive('get')
            ->once()
            ->with(TestFirstProcessor::class)
            ->andReturn($firstProcessor);
        $container->shouldReceive('get')
            ->once()
            ->with(TestSecondProcessor::class)
            ->andReturn($secondProcessor);

        $pipeline = new ImageProcessorPipeline($container);
        $result = $pipeline->process($context, [TestFirstProcessor::class, TestSecondProcessor::class]);

        $this->assertSame(['first', 'second'], $sequence);
        $this->assertSame('https://cdn.example.com/final.png', $result->getUploadedUrl());
    }
}

final class TestFirstProcessor implements ImageProcessorInterface
{
    public function process(ImageProcessContext $context): void
    {
    }
}

final class TestSecondProcessor implements ImageProcessorInterface
{
    public function process(ImageProcessContext $context): void
    {
    }
}
