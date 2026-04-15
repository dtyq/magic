<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Rpc\Service;

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
}
