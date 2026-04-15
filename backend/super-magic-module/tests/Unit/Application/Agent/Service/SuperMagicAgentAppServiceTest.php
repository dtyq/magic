<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Application\Agent\Service;

use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentTool;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentToolType;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;

/**
 * @internal
 */
class SuperMagicAgentAppServiceTest extends TestCase
{
    private SuperMagicAgentAppService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = (new ReflectionClass(SuperMagicAgentAppService::class))->newInstanceWithoutConstructor();
    }

    public function testHydrateToolSchemasAddsKnowledgeSearchSchemaWhenToolExists(): void
    {
        $tool = new SuperMagicAgentTool();
        $tool->setCode('search_knowledge');
        $tool->setName('Knowledge Search');
        $tool->setDescription('Search for knowledge and related context');
        $tool->setType(SuperMagicAgentToolType::BuiltIn);

        $agent = new class([$tool]) extends SuperMagicAgentEntity {
            public function __construct(private array $stubTools)
            {
            }

            public function getTools(): array
            {
                return $this->stubTools;
            }
        };

        $flowDataIsolation = (new ReflectionClass(FlowDataIsolation::class))->newInstanceWithoutConstructor();

        $method = new ReflectionMethod($this->service, 'hydrateToolSchemas');
        $method->setAccessible(true);
        $method->invoke($this->service, $agent, $flowDataIsolation);

        self::assertSame(
            [
                'type' => 'object',
                'properties' => [
                    'query' => [
                        'type' => 'string',
                        'description' => '用于检索相关知识上下文的查询语句。',
                    ],
                ],
                'required' => ['query'],
                'additionalProperties' => false,
            ],
            $tool->getSchema()
        );
    }

    public function testEnsureAgentAccessibleRejectsCreatorWithoutResourceVisibility(): void
    {
        $this->setProperty($this->service, 'resourceVisibilityDomainService', $this->createResourceVisibilityDomainService([]));
        $this->setProperty($this->service, 'modeDomainService', $this->createModeDomainService([]));

        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('DT001');

        $method = new ReflectionMethod($this->service, 'ensureAgentAccessible');
        $method->setAccessible(true);

        $this->expectException(BusinessException::class);
        $method->invoke($this->service, $authorization, 'creator-only-agent');
    }

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
                return ['list' => []];
            }
        };
    }

    private function setProperty(object $object, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty($object, $property);
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue($object, $value);
    }
}
