<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\MCP;

use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Domain\MCP\Factory\MCPServerFactory;
use App\Domain\MCP\Repository\Persistence\Model\MCPServerModel;
use DateTime;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @internal
 */
final class MCPServerFactoryTest extends TestCase
{
    public function testServiceConfigIsReadOnlyOnce(): void
    {
        $model = $this->makeModel([
            'service_config' => json_encode(['url' => 'https://example.com/sse']),
            'external_sse_url' => '',
        ]);

        $entity = MCPServerFactory::createEntity($model);

        self::assertSame(ServiceType::ExternalSSE, $entity->getType());
        self::assertSame(1, $model::$serviceConfigReads, 'service_config 是 JSON cast，应只读取（decode）一次');
        self::assertSame(1, $model::$typeReads, 'type 应只读取一次');
    }

    public function testFallsBackToExternalSseUrl(): void
    {
        $model = $this->makeModel([
            'service_config' => null,
            'external_sse_url' => 'https://legacy.example.com/sse',
        ]);

        $entity = MCPServerFactory::createEntity($model);

        self::assertSame(1, $model::$serviceConfigReads);
        self::assertSame(ServiceType::ExternalSSE, $entity->getType());
        self::assertNotNull($entity->getServiceConfig());
    }

    private function makeModel(array $attributes): CountingMCPServerModel
    {
        CountingMCPServerModel::$serviceConfigReads = 0;
        CountingMCPServerModel::$typeReads = 0;

        $model = (new ReflectionClass(CountingMCPServerModel::class))->newInstanceWithoutConstructor();
        $model->setRawAttributes($attributes + [
            'id' => 1,
            'organization_code' => 'org',
            'code' => 'c1',
            'name' => 'n',
            'description' => 'd',
            'icon' => '',
            'type' => ServiceType::ExternalSSE->value,
            'enabled' => 1,
            'creator' => 'u',
            'modifier' => 'u',
        ]);
        return $model;
    }
}

class CountingMCPServerModel extends MCPServerModel
{
    public static int $serviceConfigReads = 0;

    public static int $typeReads = 0;

    public function getAttribute($key)
    {
        if ($key === 'service_config') {
            ++self::$serviceConfigReads;
        } elseif ($key === 'type') {
            ++self::$typeReads;
        }
        // 日期 cast 会取容器里的连接，测试环境没有容器，直接返回 DateTime
        if ($key === 'created_at' || $key === 'updated_at') {
            return new DateTime();
        }
        return parent::getAttribute($key);
    }
}
