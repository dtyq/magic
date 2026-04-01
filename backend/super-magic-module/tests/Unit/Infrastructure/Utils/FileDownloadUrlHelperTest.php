<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Infrastructure\Utils\FileDownloadUrlHelper;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class FileDownloadUrlHelperTest extends TestCase
{
    private ?string $originalFileDriver = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalFileDriver = getenv('FILE_DRIVER') === false ? null : getenv('FILE_DRIVER');
        putenv('FILE_DRIVER=oss');

        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturn('watermark-text');

        ApplicationContext::setContainer(new class($translator) implements ContainerInterface {
            public function __construct(private readonly TranslatorInterface $translator)
            {
            }

            public function get(string $id)
            {
                if ($id === TranslatorInterface::class) {
                    return $this->translator;
                }

                throw new class(sprintf('Service %s not found.', $id)) extends RuntimeException implements NotFoundExceptionInterface {
                };
            }

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class;
            }
        });
    }

    protected function tearDown(): void
    {
        if ($this->originalFileDriver === null) {
            putenv('FILE_DRIVER');
        } else {
            putenv('FILE_DRIVER=' . $this->originalFileDriver);
        }

        $reflectionProperty = new ReflectionProperty(ApplicationContext::class, 'container');
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue(null, null);

        parent::tearDown();
    }

    public function testPreviewForAiGeneratedImageAddsWatermark(): void
    {
        $options = FileDownloadUrlHelper::prepareFileUrlOptions(
            'demo.png',
            'preview',
            true,
            TaskFileSource::AI_IMAGE_GENERATION
        );

        $this->assertArrayHasKey('custom_query', $options);
        $this->assertArrayHasKey('x-oss-process', $options['custom_query']);
        $this->assertStringContainsString('image/watermark', $options['custom_query']['x-oss-process']);
    }

    public function testPreviewForAiGeneratedVideoDoesNotAddImageWatermark(): void
    {
        $options = FileDownloadUrlHelper::prepareFileUrlOptions(
            'demo.mp4',
            'preview',
            true,
            TaskFileSource::AI_VIDEO_GENERATION
        );

        $this->assertArrayHasKey('custom_query', $options);
        $this->assertArrayNotHasKey('x-oss-process', $options['custom_query']);
    }

    public function testPreviewForNonAiSourceDoesNotAddWatermark(): void
    {
        $options = FileDownloadUrlHelper::prepareFileUrlOptions(
            'demo.png',
            'preview',
            true,
            TaskFileSource::AGENT
        );

        $this->assertArrayHasKey('custom_query', $options);
        $this->assertArrayNotHasKey('x-oss-process', $options['custom_query']);
    }

    public function testPreviewForScalarAiGeneratedImageAddsWatermark(): void
    {
        $options = FileDownloadUrlHelper::prepareFileUrlOptions(
            'demo.png',
            'preview',
            true,
            '5'
        );

        $this->assertArrayHasKey('custom_query', $options);
        $this->assertArrayHasKey('x-oss-process', $options['custom_query']);
    }
}
