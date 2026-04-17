<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Entity\Dto;

use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Infrastructure\Core\Exception\BusinessException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class CreateVideoDTOTest extends TestCase
{
    public function testJsonStringFieldsAreHydratedToArrays(): void
    {
        $dto = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
            'inputs' => '{"frames":[{"role":"start","uri":"https://example.com/start.png"}]}',
            'generation' => '{"resolution":"1080p","enhance_prompt":true}',
            'callbacks' => '{"webhook_url":"https://example.com/webhook"}',
            'execution' => '{"service_tier":"default"}',
            'extensions' => '{"vendor":{"mode":"fast"}}',
        ]);

        $dto->valid();

        $this->assertSame(
            [['role' => 'start', 'uri' => 'https://example.com/start.png']],
            $dto->getInputs()['frames'],
        );
        $this->assertSame('1080p', $dto->getGeneration()['resolution']);
        $this->assertSame(['mode' => 'fast'], $dto->getExtensions()['vendor']);
    }

    public function testInvalidJsonInputsAreRejected(): void
    {
        $dto = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
            'inputs' => 'not-json',
        ]);

        $this->expectException(BusinessException::class);
        $dto->valid();
    }

    public function testScalarJsonGenerationIsRejected(): void
    {
        $dto = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
            'generation' => '1',
        ]);

        $this->expectException(BusinessException::class);
        $dto->valid();
    }

    public function testBusinessParamsAreAccepted(): void
    {
        $dto = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
            'business_params' => [
                'organization_code' => 'DT001',
                'user_id' => 'user-1',
                'source_id' => 'design_video_generation',
            ],
        ]);

        $dto->valid();

        $this->assertSame('design_video_generation', $dto->getBusinessParam('source_id'));
    }

    public function testCanonicalSchemaFieldsAreAccepted(): void
    {
        $dto = new CreateVideoDTO([
            'model_id' => 'veo-3.1-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a reference-driven clip',
            'input_mode' => 'omni_reference',
            'inputs' => [
                'mask' => ['uri' => 'https://example.com/mask.png'],
                'reference_audios' => [['uri' => 'https://example.com/ref.wav']],
                'reference_videos' => [['uri' => 'https://example.com/ref.mp4']],
            ],
            'generation' => [
                'size' => '1920x1080',
                'width' => 1920,
                'height' => 1080,
                'resolution' => '4K',
                'enhance_prompt' => true,
                'camera_fixed' => true,
                'return_last_frame' => true,
            ],
            'callbacks' => [
                'webhook_url' => 'https://example.com/webhook',
            ],
            'execution' => [
                'service_tier' => 'default',
                'expires_after_seconds' => 600,
            ],
        ]);

        $dto->valid();

        $this->assertSame('omni_reference', $dto->getInputMode());
        $this->assertSame([['uri' => 'https://example.com/ref.mp4']], $dto->getInputs()['reference_videos']);
        $this->assertSame('generate', $dto->getTask());
        $this->assertSame('1920x1080', $dto->getGeneration()['size']);
        $this->assertSame(1920, $dto->getGeneration()['width']);
        $this->assertSame(1080, $dto->getGeneration()['height']);
        $this->assertTrue($dto->getGeneration()['enhance_prompt']);
    }
}
