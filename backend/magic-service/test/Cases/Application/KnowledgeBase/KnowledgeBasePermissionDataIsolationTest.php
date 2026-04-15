<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\KnowledgeBase;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBasePermissionDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseOrganizationInfoManager;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use stdClass;

/**
 * @internal
 */
class KnowledgeBasePermissionDataIsolationTest extends TestCase
{
    public function testCreateByBaseDataIsolationDoesNotTriggerDeferredManagers(): void
    {
        [$source, $subscriptionManager, $organizationInfoManager, $counter] = $this->createKnowledgeBaseDataIsolation();

        KnowledgeBasePermissionDataIsolation::createByBaseDataIsolation($source);

        $this->assertSame(0, $counter->subscription);
        $this->assertSame(0, $counter->organization);
        $this->assertSame('', $subscriptionManager->getCurrentSubscriptionId());
        $this->assertSame('', $organizationInfoManager->getOrganizationName());
    }

    public function testDeferredManagersRemainLazyUntilExplicitAccess(): void
    {
        [$source, $subscriptionManager, $organizationInfoManager, $counter] = $this->createKnowledgeBaseDataIsolation();

        $permissionDataIsolation = KnowledgeBasePermissionDataIsolation::createByBaseDataIsolation($source);

        $this->assertSame('sub-001', $permissionDataIsolation->getSubscriptionManager()->getCurrentSubscriptionId());
        $this->assertSame('Test Org', $permissionDataIsolation->getOrganizationInfoManager()->getOrganizationName());
        $this->assertSame(1, $counter->subscription);
        $this->assertSame(1, $counter->organization);

        $source->getSubscriptionManager();
        $source->getOrganizationInfoManager();

        $this->assertSame(1, $counter->subscription);
        $this->assertSame(1, $counter->organization);
        $this->assertSame('sub-001', $subscriptionManager->getCurrentSubscriptionId());
        $this->assertSame('Test Org', $organizationInfoManager->getOrganizationName());
    }

    /**
     * @return array{0: KnowledgeBaseDataIsolation, 1: BaseSubscriptionManager, 2: BaseOrganizationInfoManager, 3: stdClass}
     */
    private function createKnowledgeBaseDataIsolation(): array
    {
        $dataIsolation = new KnowledgeBaseDataIsolation('DT001', 'user-1', 'magic-1');
        $subscriptionManager = new BaseSubscriptionManager();
        $organizationInfoManager = new BaseOrganizationInfoManager();
        $counter = (object) [
            'subscription' => 0,
            'organization' => 0,
        ];

        $this->setPrivateProperty($dataIsolation, 'subscriptionManager', $subscriptionManager);
        $this->setPrivateProperty($dataIsolation, 'organizationInfoManager', $organizationInfoManager);

        $dataIsolation->addLazyFunction('initSubscription', function () use ($counter, $subscriptionManager): void {
            ++$counter->subscription;
            $subscriptionManager->setCurrentSubscription('sub-001', ['product' => ['id' => 'product-1']]);
        });

        $dataIsolation->addLazyFunction('initOrganizationInfo', function () use ($counter, $organizationInfoManager): void {
            ++$counter->organization;
            $organizationInfoManager->setOrganizationName('Test Org');
        });

        return [$dataIsolation, $subscriptionManager, $organizationInfoManager, $counter];
    }

    private function setPrivateProperty(object $target, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty(BaseDataIsolation::class, $property);
        $reflectionProperty->setValue($target, $value);
    }
}
