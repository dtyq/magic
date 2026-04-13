<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Provider\Entity\ValueObject\Category;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AdminProviderAppServiceTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://admin.example.com', 'admin-key');
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testGetOrganizationProvidersModelsByCategoryReturnsVideoProviderFromGenericFlow(): void
    {
        $service = di(AdminProviderAppService::class);
        $providers = $service->getOrganizationProvidersModelsByCategory(self::TEST_OFFICIAL_ORGANIZATION_CODE, Category::VGM);

        $matchedProvider = null;
        foreach ($providers as $provider) {
            if ((string) $provider->getId() === (string) self::TEST_PROVIDER_CONFIG_ID) {
                $matchedProvider = $provider;
                break;
            }
        }

        $this->assertNotNull($matchedProvider);
        $this->assertSame(Category::VGM, $matchedProvider->getCategory());
        $this->assertSame('Cloudsway', $matchedProvider->getProviderCode()?->value);
        $this->assertSame((string) self::TEST_PROVIDER_CONFIG_ID, (string) $matchedProvider->getId());
    }
}
