<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\DeploymentIdConstant;
use Hyperf\Contract\ConfigInterface;
use HyperfTest\HttpTestCase;
use ReflectionMethod;

/**
 * @internal
 */
class AdminProviderAppServiceWhitelistTest extends HttpTestCase
{
    private const string OFFICIAL_ORGANIZATION_CODE = 'OFFICIAL_ORG';

    private const string WHITELISTED_ORGANIZATION_CODE = 'ORG_WHITE';

    private ConfigInterface $config;

    private PlatformSettingsAppService $platformSettingsAppService;

    private string $originOfficeOrganization;

    private string $originDeploymentId;

    private array $originPlatformSettings = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->config = $this->getContainer()->get(ConfigInterface::class);
        $this->platformSettingsAppService = $this->getContainer()->get(PlatformSettingsAppService::class);
        $this->originOfficeOrganization = (string) $this->config->get('service_provider.office_organization', '');
        $this->originDeploymentId = (string) $this->config->get('super-magic.sandbox.deployment_id', '');
        $this->originPlatformSettings = $this->platformSettingsAppService->get()->toArray();
    }

    protected function tearDown(): void
    {
        $this->config->set('service_provider.office_organization', $this->originOfficeOrganization);
        $this->config->set('super-magic.sandbox.deployment_id', $this->originDeploymentId);
        $this->platformSettingsAppService->save(PlatformSettings::fromArray($this->originPlatformSettings));

        parent::tearDown();
    }

    public function testShouldRestrictNonOfficialOrganizationTemplatesSkipsWhitelistedOrganization(): void
    {
        $this->setDomesticNonOfficialScenario();
        $this->platformSettingsAppService->save(PlatformSettings::fromArray([
            'custom_service_provider_whitelist' => [self::WHITELISTED_ORGANIZATION_CODE],
        ]));

        $service = $this->getContainer()->get(AdminProviderAppService::class);

        $restricted = $this->invokePrivateMethod(
            $service,
            'shouldRestrictNonOfficialOrganizationTemplates',
            self::WHITELISTED_ORGANIZATION_CODE,
            Category::LLM
        );

        $this->assertFalse($restricted);
    }

    public function testValidateAllowedProviderForNonOfficialOrganizationAllowsCustomProviderForWhitelistedOrganization(): void
    {
        $this->setDomesticNonOfficialScenario();
        $this->platformSettingsAppService->save(PlatformSettings::fromArray([
            'custom_service_provider_whitelist' => [self::WHITELISTED_ORGANIZATION_CODE],
        ]));

        $service = $this->getContainer()->get(AdminProviderAppService::class);

        try {
            $this->invokePrivateMethod(
                $service,
                'validateAllowedProviderForNonOfficialOrganization',
                self::WHITELISTED_ORGANIZATION_CODE,
                ProviderCode::OpenAI,
                Category::LLM
            );
            $this->assertTrue(true);
        } catch (BusinessException $exception) {
            $this->fail('Whitelisted organization should be allowed to configure custom providers.');
        }
    }

    public function testValidateAllowedProviderForNonOfficialOrganizationRejectsCustomProviderForNonWhitelistedOrganization(): void
    {
        $this->setDomesticNonOfficialScenario();
        $this->platformSettingsAppService->save(PlatformSettings::fromArray([
            'custom_service_provider_whitelist' => [],
        ]));

        $service = $this->getContainer()->get(AdminProviderAppService::class);

        $this->expectException(BusinessException::class);

        $this->invokePrivateMethod(
            $service,
            'validateAllowedProviderForNonOfficialOrganization',
            'ORG_BLOCKED',
            ProviderCode::OpenAI,
            Category::LLM
        );
    }

    private function setDomesticNonOfficialScenario(): void
    {
        $this->config->set('service_provider.office_organization', self::OFFICIAL_ORGANIZATION_CODE);
        $this->config->set('super-magic.sandbox.deployment_id', DeploymentIdConstant::TEST);
    }

    private function invokePrivateMethod(object $target, string $methodName, mixed ...$args): mixed
    {
        $method = new ReflectionMethod($target, $methodName);
        $method->setAccessible(true);

        return $method->invoke($target, ...$args);
    }
}
