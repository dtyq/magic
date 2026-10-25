<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Agent;

use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\AgentMarketModel;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\AgentVersionModel;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\SuperMagic\Agent\Assembler\SuperMagicAgentMarketAssembler;
use App\Interfaces\SuperMagic\Agent\DTO\Request\PublishAgentRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentMarketsRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentListItemDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentMarketListItemDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentPublishPrefillResponseDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\GetAgentMarketDetailResponseDTO;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/**
 * @internal
 */
final class AgentCategoryIdRemovalContractTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer(new class implements ContainerInterface {
                public function get(string $id)
                {
                    return match ($id) {
                        PhpSerializerPacker::class => new PhpSerializerPacker(),
                        default => throw new RuntimeException('Unsupported service: ' . $id),
                    };
                }

                public function has(string $id): bool
                {
                    return $id === PhpSerializerPacker::class;
                }
            });
        }
    }

    public function testAgentEntitiesExposeOnlyCategoryIds(): void
    {
        foreach ([AgentMarketEntity::class, AgentVersionEntity::class] as $entityClass) {
            $reflection = new ReflectionClass($entityClass);

            $this->assertFalse($reflection->hasProperty('categoryId'));
            $this->assertFalse($reflection->hasMethod('getCategoryId'));
            $this->assertFalse($reflection->hasMethod('setCategoryId'));

            $entity = new $entityClass(['categoryIds' => [10, 20]]);
            $this->assertSame([10, 20], $entity->getCategoryIds());
            $source = (string) file_get_contents((new ReflectionClass($entityClass))->getFileName());
            $this->assertDoesNotMatchRegularExpression("/'category_id'\\s*=>/", $source);
        }
    }

    public function testAgentMainModelsDoNotDeclareLegacyCategoryColumn(): void
    {
        foreach ([AgentMarketModel::class, AgentVersionModel::class] as $modelClass) {
            $defaults = (new ReflectionClass($modelClass))->getDefaultProperties();

            $this->assertNotContains('category_id', $defaults['fillable'] ?? []);
            $this->assertArrayNotHasKey('category_id', $defaults['casts'] ?? []);
        }
    }

    public function testAgentRequestsDoNotAcceptLegacyCategoryId(): void
    {
        foreach ([PublishAgentRequestDTO::class, QueryAgentMarketsRequestDTO::class] as $dtoClass) {
            $reflection = new ReflectionClass($dtoClass);

            $this->assertFalse($reflection->hasProperty('categoryId'));
            $this->assertFalse($reflection->hasMethod('getCategoryId'));
            $this->assertFalse($reflection->hasMethod('setCategoryId'));

            $rules = new ReflectionMethod($dtoClass, 'getHyperfValidationRules');
            $rules->setAccessible(true);
            $this->assertArrayNotHasKey('category_id', $rules->invoke(null));
        }
    }

    public function testAgentResponsesDoNotOutputLegacySingleCategoryFields(): void
    {
        $market = new AgentMarketListItemDTO(
            id: 1,
            agentCode: 'agent-code',
            userCode: null,
            nameI18n: ['default' => 'Agent name'],
            roleI18n: ['default' => ['Agent role']],
            descriptionI18n: ['default' => 'Agent description'],
            icon: null,
            iconType: 1,
            playbooks: [],
            publisherType: 'USER',
            publisher: [],
            categoryIds: [10, 20],
            isFeatured: false,
            marketType: 'MARKET',
            isAdded: false,
            latestVersionCode: null,
            allowDelete: false,
            createdAt: '',
            updatedAt: '',
        );

        $this->assertArrayNotHasKey('category_id', $market->toArray());
        $this->assertArrayNotHasKey('category', $market->toArray());
        $this->assertSame(['default' => 'Agent name'], $market->toArray()['name_i18n']);
        $this->assertSame(['default' => ['Agent role']], $market->toArray()['role_i18n']);
        $this->assertSame(['default' => 'Agent description'], $market->toArray()['description_i18n']);

        $prefill = new AgentPublishPrefillResponseDTO('1.0.0', [], 'MARKET', null, [10, 20]);
        $this->assertArrayNotHasKey('category_id', $prefill->toArray());

        $detail = new GetAgentMarketDetailResponseDTO(
            '1',
            'agent-code',
            'Agent',
            [],
            '',
            [],
            null,
            null,
            null,
            1,
            [10, 20],
            '1.0.0',
            '',
            null
        );
        $this->assertArrayNotHasKey('category_id', $detail->toArray());
    }

    public function testAgentQueryListResponseUsesLocalizedFields(): void
    {
        $agent = new AgentListItemDTO(
            id: 1,
            code: 'agent-code',
            projectId: null,
            nameI18n: ['default' => 'Agent name'],
            roleI18n: ['default' => ['Agent role']],
            descriptionI18n: ['default' => 'Agent description'],
            icon: null,
            iconType: 1,
            playbooks: [],
            sourceType: 'LOCAL_CREATE',
            source: 'LOCAL_CREATE',
            enabled: true,
            isStoreOffline: null,
            latestVersionCode: null,
            publishTargetType: null,
            origin: 'created',
            allowDelete: false,
            pinnedAt: null,
            latestPublishedAt: null,
            updatedAt: '',
            createdAt: '',
        );

        $payload = $agent->toArray();

        $this->assertSame(['default' => 'Agent name'], $payload['name_i18n']);
        $this->assertSame(['default' => ['Agent role']], $payload['role_i18n']);
        $this->assertSame(['default' => 'Agent description'], $payload['description_i18n']);
    }

    public function testAgentMarketQueryPreservesLocalizedFields(): void
    {
        CoContext::setLanguage('zh_CN');
        $market = new AgentMarketEntity([
            'id' => 1,
            'agent_code' => 'agent-code',
            'agent_version_id' => 1,
            'publisher_id' => 'publisher',
            'name_i18n' => ['default' => 'Default name', 'zh_CN' => '中文名称'],
            'role_i18n' => ['default' => ['Default role'], 'zh_CN' => ['中文角色']],
            'description_i18n' => ['default' => 'Default description', 'zh_CN' => '中文描述'],
            'market_type' => 'MARKET',
        ]);

        $payload = SuperMagicAgentMarketAssembler::createQueryAgentMarketsResponseDTO(
            [$market],
            [],
            [],
            [],
            [],
            1,
            20,
            1,
        )->toArray()['list'][0];

        $this->assertSame(['default' => 'Default name', 'zh_CN' => '中文名称'], $payload['name_i18n']);
        $this->assertSame(['default' => ['Default role'], 'zh_CN' => ['中文角色']], $payload['role_i18n']);
        $this->assertSame(['default' => 'Default description', 'zh_CN' => '中文描述'], $payload['description_i18n']);
    }
}
