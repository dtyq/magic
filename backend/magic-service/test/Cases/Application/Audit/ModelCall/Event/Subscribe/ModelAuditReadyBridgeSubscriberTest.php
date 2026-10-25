<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\Audit\ModelCall\Event\Subscribe\ModelAuditReadyBridgeSubscriber;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditHourlyRecordRepositoryInterface;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditLogRepositoryInterface;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\Provider\Service\ProviderModelDomainService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
class ModelAuditReadyBridgeSubscriberTest extends TestCase
{
    public function testVideoGeneratedUsageIncludesHasAudioOutput(): void
    {
        $repository = new RecordingAuditLogRepository();
        $subscriber = new ModelAuditReadyBridgeSubscriber(
            new ModelCallAuditDomainService($repository, $this->createStub(AuditHourlyRecordRepositoryInterface::class)),
            (new ReflectionClass(ProviderModelDomainService::class))->newInstanceWithoutConstructor(),
            new NullLogger(),
        );
        $event = new VideoGeneratedEvent();
        $event->setOrganizationCode('org-1');
        $event->setUserId('user-1');
        $event->setModel('keling-video');
        $event->setOriginalModelId('keling-video');
        $event->setProviderModelId('provider-model');
        $event->setDurationSeconds(5);
        $event->setResolution('768p');
        $event->setSize('1344x768');
        $event->setWidth(1344);
        $event->setHeight(768);
        $event->setHasAudioOutput(false);
        $event->setThoughtTokens(452);
        $event->setBillingTokenUsage([
            'input_tokens' => 528,
            'output_text_tokens' => 0,
            'output_video_tokens' => 57920,
        ]);
        $event->setVideoReferenceMaterial([
            'input_mode' => 'omni_reference',
            'reference_image_count' => 2,
            'reference_video_count' => 1,
            'reference_audio_count' => 1,
            'input_video_duration_seconds' => 10,
        ]);
        $event->setBusinessParams([
            'event_id' => '10001',
            'model_id' => 'keling-video',
            'request_id' => 'request-1',
        ]);

        $subscriber->process($event);

        $this->assertCount(1, $repository->entities);
        $usage = $repository->entities[0]->getUsage();
        $this->assertFalse($usage['has_audio_output']);
        $this->assertSame(1, $usage['count']);
        $this->assertSame('768p', $usage['resolution']);
        $this->assertSame('1344x768', $usage['size']);
        $this->assertSame(1344, $usage['width']);
        $this->assertSame(768, $usage['height']);
        $this->assertSame(2, $usage['reference_image_count']);
        $this->assertSame(1, $usage['reference_video_count']);
        $this->assertSame(1, $usage['reference_audio_count']);
        $this->assertSame(10, $usage['input_video_duration_seconds']);
        $this->assertSame(528, $usage['input_tokens']);
        $this->assertSame(0, $usage['output_text_tokens']);
        $this->assertSame(57920, $usage['output_video_tokens']);
        $this->assertSame(452, $usage['thought_tokens']);
    }

    public function testImageGeneratedEventBuiltFromImageFlowCarriesImageSize(): void
    {
        $requestDTO = new TextGenerateImageDTO();
        $requestDTO->setModel('gpt-image');
        $requestDTO->setImages(['image-1.png', 'image-2.png']);

        $service = (new ReflectionClass(LLMAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(LLMAppService::class, 'buildImageGenerateEntity');

        $event = $method->invokeArgs($service, [
            'user-1',
            'org-1',
            $requestDTO,
            1,
            'provider-model',
            null,
            '2026-07-21 12:00:00',
            123,
            null,
            null,
            '1K',
            '1024x1536',
        ]);

        $this->assertSame('1024x1536', $event->getImageSize());
        $this->assertTrue(method_exists($event, 'getReferenceImageCount'));
        $this->assertSame(2, $event->getReferenceImageCount());
    }

    public function testImageGeneratedUsageIncludesReferenceImageCount(): void
    {
        $repository = new RecordingAuditLogRepository();
        $subscriber = new ModelAuditReadyBridgeSubscriber(
            new ModelCallAuditDomainService($repository, $this->createStub(AuditHourlyRecordRepositoryInterface::class)),
            (new ReflectionClass(ProviderModelDomainService::class))->newInstanceWithoutConstructor(),
            new NullLogger(),
        );
        $event = new ImageGeneratedEvent();
        $event->setOrganizationCode('org-1');
        $event->setUserId('user-1');
        $event->setModel('gpt-image');
        $event->setProviderModelId('provider-model');
        $event->setImageCount(1);
        $event->setResolution('2k');
        $event->setImageSize('2048x2048');
        $event->setBusinessParams([
            'event_id' => '10002',
            'model_id' => 'gpt-image',
            'provider_model_id' => 'provider-model',
            'request_id' => 'request-1',
            'status' => 'SUCCESS',
            'image_count' => 1,
            'reference_image_count' => 2,
        ]);

        $subscriber->process($event);

        $this->assertCount(1, $repository->entities);
        $usage = $repository->entities[0]->getUsage();
        $this->assertSame(2, $usage['reference_image_count']);
        $this->assertSame(1, $usage['image_count']);
        $this->assertSame('2k', $usage['resolution']);
        $this->assertSame('2048x2048', $usage['size']);
    }
}

final class RecordingAuditLogRepository implements AuditLogRepositoryInterface
{
    /** @var list<AuditLogEntity> */
    public array $entities = [];

    public function create(AuditLogEntity $entity): void
    {
        $this->entities[] = $entity;
    }

    public function createOrUpdateAuditByEventId(AuditLogEntity $entity): void
    {
        $this->entities[] = $entity;
    }

    public function recordPointsByEventId(string $eventId, int $points): void
    {
    }

    public function queries(
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false,
        ?string $cursorId = null,
        string $direction = 'next'
    ): array {
        return ['list' => [], 'next_cursor_id' => null, 'prev_cursor_id' => null, 'has_more' => false];
    }

    public function statistics(array $filters, string $currentOrganizationCode, bool $isOfficialOrganization): array
    {
        return ['summary' => [], 'trend' => [], 'breakdown' => []];
    }
}
