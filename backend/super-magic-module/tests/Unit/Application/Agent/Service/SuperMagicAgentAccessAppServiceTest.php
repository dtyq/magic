<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Application\Agent\Service;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAccessAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionProperty;

/**
 * @internal
 */
class SuperMagicAgentAccessAppServiceTest extends TestCase
{
    private SuperMagicAgentAccessAppService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = (new ReflectionClass(SuperMagicAgentAccessAppService::class))->newInstanceWithoutConstructor();
    }

    public function testListAccessibleAgentCodesReturnsVisibleSharedAgent(): void
    {
        $this->setProperty($this->service, 'superMagicAgentDomainService', $this->createAgentDomainService([
            $this->createAgentEntity('shared-agent'),
        ]));
        $this->setProperty($this->service, 'resourceVisibilityDomainService', $this->createResourceVisibilityDomainService([
            'shared-agent',
        ]));
        $this->setProperty($this->service, 'modeDomainService', $this->createModeDomainService([]));

        $result = $this->service->listAccessibleAgentCodes('DT001', 'user-1', ['shared-agent']);

        self::assertSame(['shared-agent'], $result['accessible_codes']);
        self::assertSame([], $result['missing_codes']);
    }

    public function testListAccessibleAgentCodesIncludesOfficialAgentCode(): void
    {
        $this->setProperty($this->service, 'superMagicAgentDomainService', $this->createAgentDomainService([]));
        $this->setProperty($this->service, 'resourceVisibilityDomainService', $this->createResourceVisibilityDomainService([]));
        $this->setProperty($this->service, 'modeDomainService', $this->createModeDomainService(['official-agent']));

        $result = $this->service->listAccessibleAgentCodes('DT001', 'user-1', ['official-agent', 'unknown-agent']);

        self::assertSame(['official-agent'], $result['accessible_codes']);
        self::assertSame(['unknown-agent'], $result['missing_codes']);
    }

    public function testListAccessibleAgentCodesDoesNotGrantCreatorWithoutResourceVisibility(): void
    {
        $this->setProperty($this->service, 'superMagicAgentDomainService', $this->createAgentDomainService([
            $this->createAgentEntity('creator-only-agent'),
        ]));
        $this->setProperty($this->service, 'resourceVisibilityDomainService', $this->createResourceVisibilityDomainService([]));
        $this->setProperty($this->service, 'modeDomainService', $this->createModeDomainService([]));

        $result = $this->service->listAccessibleAgentCodes('DT001', 'user-1', ['creator-only-agent']);

        self::assertSame([], $result['accessible_codes']);
        self::assertSame([], $result['missing_codes']);
    }

    /**
     * @param array<SuperMagicAgentEntity> $entities
     */
    private function createAgentDomainService(array $entities): SuperMagicAgentDomainService
    {
        return new readonly class($entities) extends SuperMagicAgentDomainService {
            public function __construct(private array $entities)
            {
            }

            public function findByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array
            {
                return $this->entities;
            }
        };
    }

    /**
     * @param array<string> $codes
     */
    private function createResourceVisibilityDomainService(array $codes): ResourceVisibilityDomainService
    {
        return new readonly class($codes) extends ResourceVisibilityDomainService {
            public function __construct(private array $codes)
            {
            }

            public function getUserAccessibleResourceCodes(
                PermissionDataIsolation $dataIsolation,
                string $userId,
                ResourceVisibilityResourceType $resourceType,
                ?array $resourceIds = null
            ): array {
                return $this->codes;
            }
        };
    }

    /**
     * @param array<string> $officialCodes
     */
    private function createModeDomainService(array $officialCodes): ModeDomainService
    {
        return new class($officialCodes) extends ModeDomainService {
            public function __construct(private array $officialCodes)
            {
            }

            public function getModes(ModeDataIsolation $dataIsolation, ModeQuery $query, Page $page): array
            {
                $modes = [];
                foreach ($this->officialCodes as $officialCode) {
                    $mode = new ModeEntity();
                    $mode->setIdentifier($officialCode);
                    $modes[] = $mode;
                }

                return ['list' => $modes];
            }
        };
    }

    private function createAgentEntity(string $code): SuperMagicAgentEntity
    {
        $entity = new SuperMagicAgentEntity();
        $entity->setCode($code);

        return $entity;
    }

    private function setProperty(object $object, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty($object, $property);
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue($object, $value);
    }
}
