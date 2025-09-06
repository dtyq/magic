<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Kernel;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 * @coversNothing
 */
class GlobalConfigApiTest extends AbstractHttpTest
{
    private string $url = '/api/v1/settings/global';

    public function testGetGlobalConfigDefault(): void
    {
        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];
        $this->assertArrayValueTypesEquals([
            'is_maintenance' => false,
            'maintenance_description' => '',
        ], $data, '默认全局配置结构不符', false, true);
    }

    public function testUpdateGlobalConfig(): void
    {
        $payload = [
            'is_maintenance' => true,
            'maintenance_description' => 'unit test maintenance',
        ];

        $putResponse = $this->put($this->url, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $putResponse['code']);
        $putData = $putResponse['data'];
        $this->assertArrayEquals($payload, $putData, 'PUT 返回数据不一致');

        // 再次 GET 验证缓存及持久化
        $getResponse = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $getResponse['code']);
        $getData = $getResponse['data'];
        $this->assertArrayEquals($payload, $getData, 'GET 返回数据与预期不符');
    }
}
