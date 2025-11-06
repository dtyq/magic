<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Provider\Service;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Util\AccessPointUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
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

        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $entity = $aiAbilityDomainService->getByCode(new MagicUserAuthorization(), AiAbilityCode::AiOptimization);
        $this->assertEquals(AiAbilityCode::AiOptimization, $entity->getCode());
        $this->assertEquals('ab123', $entity->getConfig()->getModelId());

        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $entity = $aiAbilityDomainService->getByCode(new MagicUserAuthorization(), AiAbilityCode::Ocr);
        $this->assertEquals(AiAbilityCode::Ocr, $entity->getCode());
        $this->assertEquals('provider_code', $entity->getConfig()->getProviderCode());
        $this->assertEquals('access_point', $entity->getConfig()->getAccessPoint());
        $this->assertEquals('api_key', $entity->getConfig()->getApiKey());

        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $entity = $aiAbilityDomainService->getByCode(new MagicUserAuthorization(), AiAbilityCode::Ocr);
        $this->assertEquals(AiAbilityCode::Ocr, $entity->getCode());
        $this->assertEquals(AccessPointUtil::DOMESTIC, $entity->getConfig()->getAccessPoint());
        $this->assertEquals('default_api_key', $entity->getConfig()->getApiKey());
    }
}
