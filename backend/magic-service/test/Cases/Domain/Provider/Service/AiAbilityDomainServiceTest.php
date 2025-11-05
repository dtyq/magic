<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Provider\Service;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Util\AccessPointUtil;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * AiAbilityDomainService 领域服务测试.
 * @internal
 */
class AiAbilityDomainServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        Mockery::close();
    }

    public function testGet()
    {
        $configInterface = di(ConfigInterface::class);
        $configInterface->set('ai_abilities.abilities.ocr.config.provider_code', 'provider_code');
        $configInterface->set('ai_abilities.abilities.ocr.config.access_point', 'access_point');
        $configInterface->set('ai_abilities.abilities.ocr.config.api_key', 'api_key');
        $configInterface->set('ai_abilities.abilities.ai_optimization.config.model_id', 'ab123');

        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $entity = $aiAbilityDomainService->getByCode(AiAbilityCode::AiOptimization);
        $this->assertEquals(AiAbilityCode::AiOptimization, $entity->getCode());
        $this->assertEquals('ab123', $entity->getConfig()->getModelId());

        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $entity = $aiAbilityDomainService->getByCode(AiAbilityCode::Ocr);
        $this->assertEquals(AiAbilityCode::Ocr, $entity->getCode());
        $this->assertEquals('provider_code', $entity->getConfig()->getProviderCode());
        $this->assertEquals('access_point', $entity->getConfig()->getAccessPoint());
        $this->assertEquals('api_key', $entity->getConfig()->getApiKey());

        $configInterface->set('ai_abilities.abilities.ocr.config.provider_code', '');
        $configInterface->set('ai_abilities.abilities.ocr.config.access_point', '');
        $configInterface->set('ai_abilities.abilities.ocr.config.api_key', '');
        $configInterface->set('ai_abilities.default_access_point', AccessPointUtil::DOMESTIC);
        $configInterface->set('ai_abilities.default_api_key', 'default_api_key');

        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $entity = $aiAbilityDomainService->getByCode(AiAbilityCode::Ocr);
        $this->assertEquals(AiAbilityCode::Ocr, $entity->getCode());
        $this->assertEquals(AccessPointUtil::DOMESTIC, $entity->getConfig()->getAccessPoint());
        $this->assertEquals('default_api_key', $entity->getConfig()->getApiKey());
    }
}
