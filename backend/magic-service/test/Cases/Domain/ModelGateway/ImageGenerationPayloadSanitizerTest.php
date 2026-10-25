<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway;

use App\Domain\ModelGateway\Entity\ImageGenerationTaskEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ImageGenerationTaskStatus;
use App\Domain\ModelGateway\Repository\ImageGenerationTaskRepositoryInterface;
use App\Domain\ModelGateway\Service\ImageGenerationPayloadSanitizer;
use App\Domain\ModelGateway\Service\ImageGenerationTaskDomainService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ImageGenerationPayloadSanitizerTest extends TestCase
{
    private const string PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

    public function testSanitizesImageBase64WithoutPersistingOriginalContent(): void
    {
        $rawBase64 = substr(self::PNG_DATA_URI, strlen('data:image/png;base64,'));

        $sanitizer = new ImageGenerationPayloadSanitizer();
        $sanitized = $sanitizer->sanitize([
            'prompt' => 'keep prompt',
            'images' => [
                self::PNG_DATA_URI,
                'https://cdn.example.com/reference.png',
            ],
            'response' => [
                'data' => [
                    ['url' => self::PNG_DATA_URI],
                    ['b64_json' => $rawBase64],
                ],
            ],
        ]);

        $this->assertSame('keep prompt', $sanitized['prompt']);
        $this->assertSame('https://cdn.example.com/reference.png', $sanitized['images'][1]);
        $this->assertSame('base64_image_omitted', $sanitized['images'][0]['type']);
        $this->assertSame('image/png', $sanitized['images'][0]['mime_type']);
        $this->assertSame('base64_image_omitted', $sanitized['response']['data'][0]['url']['type']);
        $this->assertSame('base64_image_omitted', $sanitized['response']['data'][1]['b64_json']['type']);
        $this->assertStringNotContainsString($rawBase64, json_encode($sanitized, JSON_THROW_ON_ERROR));
    }

    public function testDoesNotGuessRawBase64InArbitraryFields(): void
    {
        $rawBase64 = substr(self::PNG_DATA_URI, strlen('data:image/png;base64,'));

        $sanitizer = new ImageGenerationPayloadSanitizer();
        $sanitized = $sanitizer->sanitize([
            'note' => $rawBase64,
            'b64_json' => $rawBase64,
        ]);

        $this->assertSame($rawBase64, $sanitized['note']);
        $this->assertSame('base64_image_omitted', $sanitized['b64_json']['type']);
    }

    public function testDomainServiceSanitizesSucceededResponseBeforeSavingTask(): void
    {
        $rawBase64 = substr(self::PNG_DATA_URI, strlen('data:image/png;base64,'));
        $repository = new class implements ImageGenerationTaskRepositoryInterface {
            public ?ImageGenerationTaskEntity $saved = null;

            public function getById(string $id): ?ImageGenerationTaskEntity
            {
                return null;
            }

            public function save(ImageGenerationTaskEntity $entity): void
            {
                $this->saved = $entity;
            }

            public function markTimedOutBatch(
                string $createdBefore,
                string $errorCode,
                string $errorMessage,
                int $limit
            ): int {
                return 0;
            }
        };
        $service = new ImageGenerationTaskDomainService($repository, new ImageGenerationPayloadSanitizer());
        $task = new ImageGenerationTaskEntity(
            id: 'IGT-test',
            organizationCode: 'org-test',
            userId: 'user-test',
            accessTokenId: '123',
            environment: 'local',
            model: 'seedream',
            requestPayload: ['prompt' => 'test'],
            status: ImageGenerationTaskStatus::RUNNING,
            createdAt: '2026-05-14 10:00:00',
            startedAt: '2026-05-14 10:00:00',
        );

        $service->finishSucceeded($task, [
            'data' => [
                ['url' => self::PNG_DATA_URI],
            ],
        ]);

        $this->assertSame($task, $repository->saved);
        $this->assertSame('base64_image_omitted', $task->getResponsePayload()['data'][0]['url']['type']);
        $this->assertStringNotContainsString($rawBase64, json_encode($task->getResponsePayload(), JSON_THROW_ON_ERROR));
    }
}
