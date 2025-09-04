<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use App\Infrastructure\ImageGenerate\XmpWatermarkEmbedder;
use HyperfTest\Cases\BaseTest;
use Mockery;
use Psr\Log\LoggerInterface;

use function Hyperf\Support\now;

/**
 * @internal
 */
class XmpWatermarkEmbedderTest extends BaseTest
{
    private XmpWatermarkEmbedder $embedder;

    private LoggerInterface $logger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->logger = Mockery::mock(LoggerInterface::class);
        $this->embedder = new XmpWatermarkEmbedder($this->logger);
    }

    public function test()
    {
        $url = '';
        $di = di(ImageWatermarkProcessor::class);
        $imageGenerateRequest = new ImageGenerateRequest();
        $watermark = new ImplicitWatermark();
        $watermark->setTopicId('123');
        $watermark->setUserId('123');
        $watermark->setOrganizationCode('DT001');
        $watermark->setCreatedAt(now());
        $watermark->setAgentId('111');
        $imageGenerateRequest->setImplicitWatermark($watermark);
        $imageGenerateRequest->setWatermarkConfig(new WatermarkConfig('xhy123', 3, 1));
        $addWatermarkToUrl = $di->addWatermarkToUrl($url, $imageGenerateRequest);
        var_dump($addWatermarkToUrl);
    }
}
