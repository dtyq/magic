<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\KnowledgeBase\Event\OcrRecognitionUsageEvent;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Interfaces\KnowledgeBase\Rpc\Service\OcrConfigRpcService;
use Closure;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class StubAiAbilityDomainService extends AiAbilityDomainService
{
    public function __construct(
        private Closure $getByCodeHandler,
    ) {
    }

    public function getByCode(ProviderDataIsolation $dataIsolation, AiAbilityCode $code): ?AiAbilityEntity
    {
        $handler = $this->getByCodeHandler;
        return $handler($dataIsolation, $code);
    }
}

/**
 * @internal
 */
class OcrConfigRpcServiceTest extends TestCase
{
    public function testConfigShouldFallbackProviderCodeFromEnabledProvider(): void
    {
        $entity = new AiAbilityEntity();
        $entity->setStatus(true);
        $entity->setCode(AiAbilityCode::Ocr);
        $entity->setConfig([
            'providers' => [
                [
                    'provider' => 'Volcengine',
                    'name' => 'Volcengine',
                    'access_key' => 'ak',
                    'secret_key' => 'sk',
                    'enable' => true,
                ],
            ],
        ]);

        $service = new OcrConfigRpcService(
            new StubAiAbilityDomainService(
                function (ProviderDataIsolation $dataIsolation, AiAbilityCode $code) use ($entity): ?AiAbilityEntity {
                    $this->assertSame('', $dataIsolation->getCurrentOrganizationCode());
                    $this->assertSame(AiAbilityCode::Ocr, $code);
                    return $entity;
                }
            ),
            $this->createMock(LoggerInterface::class)
        );

        $result = $service->config();

        $this->assertSame(0, $result['code']);
        $this->assertSame('Volcengine', $result['data']['provider_code']);
        $this->assertSame('Volcengine', $result['data']['providers'][0]['provider']);
    }

    public function testReportUsageDispatchesOcrRecognitionUsageEvent(): void
    {
        $dispatchedEvent = null;
        $service = new OcrConfigRpcService(
            new StubAiAbilityDomainService(fn () => null),
            $this->createMock(LoggerInterface::class),
            static function (OcrRecognitionUsageEvent $event) use (&$dispatchedEvent): void {
                $dispatchedEvent = $event;
            }
        );

        $result = $service->reportUsage([
            'provider' => 'Volcengine',
            'organization_code' => 'ORG-1',
            'user_id' => 'USER-1',
            'page_count' => 2,
            'file_type' => 'pdf',
            'business_params' => [
                'event_id' => 'EVT-1',
                'request_id' => 'REQ-1',
                'knowledge_base_code' => 'KB-1',
                'document_code' => 'DOC-1',
                'business_id' => 'BIZ-1',
                'source_id' => 'SRC-1',
                'ocr_call_type' => 'source',
            ],
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertInstanceOf(OcrRecognitionUsageEvent::class, $dispatchedEvent);
        $this->assertSame('Volcengine', $dispatchedEvent->getProvider());
        $this->assertSame('ORG-1', $dispatchedEvent->getOrganizationCode());
        $this->assertSame('USER-1', $dispatchedEvent->getUserId());
        $this->assertSame(2, $dispatchedEvent->getPageCount());
        $this->assertSame('pdf', $dispatchedEvent->getFileType());
        $this->assertSame('EVT-1', $dispatchedEvent->getBusinessParam('event_id'));
        $this->assertSame('source', $dispatchedEvent->getBusinessParam('ocr_call_type'));
        $this->assertSame(2, $dispatchedEvent->getBusinessParam('page_count'));
    }

    /**
     * @dataProvider invalidReportUsagePayloadProvider
     */
    public function testReportUsageRejectsInvalidPayload(array $payload): void
    {
        $dispatched = false;
        $service = new OcrConfigRpcService(
            new StubAiAbilityDomainService(fn () => null),
            $this->createMock(LoggerInterface::class),
            static function () use (&$dispatched): void {
                $dispatched = true;
            }
        );

        $result = $service->reportUsage($payload);

        $this->assertSame(400, $result['code']);
        $this->assertFalse($dispatched);
    }

    public static function invalidReportUsagePayloadProvider(): array
    {
        return [
            'missing provider' => [[
                'organization_code' => 'ORG-1',
                'user_id' => 'USER-1',
                'page_count' => 1,
            ]],
            'missing organization' => [[
                'provider' => 'Volcengine',
                'user_id' => 'USER-1',
                'page_count' => 1,
            ]],
            'missing user' => [[
                'provider' => 'Volcengine',
                'organization_code' => 'ORG-1',
                'page_count' => 1,
            ]],
            'invalid page count' => [[
                'provider' => 'Volcengine',
                'organization_code' => 'ORG-1',
                'user_id' => 'USER-1',
                'page_count' => 0,
            ]],
        ];
    }
}
