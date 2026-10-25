<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway;

use App\Domain\ModelGateway\Entity\ImageGenerationTaskEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ImageGenerationTaskStatus;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ImageGenerationTaskEntityTest extends TestCase
{
    public function testResponseContainsStartedAtAndExpectedFinish(): void
    {
        $task = new ImageGenerationTaskEntity(
            id: 'IGT-test',
            organizationCode: 'org-test',
            userId: 'user-test',
            accessTokenId: '123',
            environment: 'local',
            model: 'seedream',
            requestPayload: ['resolution' => '2k'],
            status: ImageGenerationTaskStatus::RUNNING,
            createdAt: '2026-05-14 10:00:00',
            startedAt: '2026-05-14 10:00:00',
        );

        $response = $task->toResponseArray();
        $this->assertSame(
            70,
            strtotime($response['expected_finished_at']) - strtotime($response['started_at'])
        );
    }

    public function testRunningTaskBecomesFailedWhenTimedOut(): void
    {
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
            startedAt: '2026-05-14 10:05:00',
        );

        $this->assertTrue($task->markTimedOutIfRunning(720, new DateTimeImmutable('2026-05-14 10:12:01')));

        $this->assertSame(ImageGenerationTaskStatus::FAILED, $task->getStatus());
        $this->assertSame('IMAGE_GENERATION_FAILED', $task->getErrorCode());
        $this->assertSame('Image generation failed, please try again later', $task->getErrorMessage());
        $this->assertSame('2026-05-14 10:12:01', $task->getFinishedAt());
    }

    public function testRunningTaskDoesNotTimeoutWithinTwelveMinutesAfterCreatedAt(): void
    {
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

        $this->assertFalse($task->markTimedOutIfRunning(720, new DateTimeImmutable('2026-05-14 10:12:00')));
        $this->assertSame(ImageGenerationTaskStatus::RUNNING, $task->getStatus());
    }

    public function testTaskPersistenceContainsEnvironment(): void
    {
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
        );

        $this->assertSame('local', $task->getEnvironment());
        $this->assertSame('local', $task->toPersistenceArray()['environment']);
    }

    public function testSucceededTaskResponseContainsOpenAIResponsePayload(): void
    {
        $task = new ImageGenerationTaskEntity(
            id: 'IGT-test',
            organizationCode: 'org-test',
            userId: 'user-test',
            accessTokenId: '123',
            environment: 'local',
            model: 'seedream',
            requestPayload: ['prompt' => 'test'],
            responsePayload: [
                'created' => 1778743200,
                'data' => [
                    ['url' => 'https://cdn.example.com/image.png'],
                ],
            ],
            status: ImageGenerationTaskStatus::SUCCEEDED,
            createdAt: '2026-05-14 10:00:00',
            startedAt: '2026-05-14 10:00:00',
            finishedAt: '2026-05-14 10:01:00',
        );

        $response = $task->toResponseArray();

        $this->assertSame('IGT-test', $response['id']);
        $this->assertSame('succeeded', $response['status']);
        $this->assertSame('https://cdn.example.com/image.png', $response['response']['data'][0]['url']);
        $this->assertNull($response['error']);
    }

    public function testFinishedTaskDoesNotBecomeSucceededAgain(): void
    {
        $task = new ImageGenerationTaskEntity(
            id: 'IGT-test',
            organizationCode: 'org-test',
            userId: 'user-test',
            accessTokenId: '123',
            environment: 'local',
            model: 'seedream',
            requestPayload: ['prompt' => 'test'],
            status: ImageGenerationTaskStatus::FAILED,
            errorCode: 'IMAGE_GENERATION_FAILED',
            errorMessage: 'Image generation failed, please try again later',
            createdAt: '2026-05-14 10:00:00',
            startedAt: '2026-05-14 10:00:00',
            finishedAt: '2026-05-14 10:20:01',
        );

        $task->markSucceeded(['data' => [['url' => 'https://cdn.example.com/late.png']]]);

        $this->assertSame(ImageGenerationTaskStatus::FAILED, $task->getStatus());
        $this->assertSame([], $task->getResponsePayload());
        $this->assertSame('IMAGE_GENERATION_FAILED', $task->getErrorCode());
    }
}
