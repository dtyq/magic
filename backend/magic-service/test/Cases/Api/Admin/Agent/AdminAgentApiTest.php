<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\Agent;

use App\Domain\Admin\Entity\ValueObject\AgentFilterType;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @coversNothing
 */
class AdminAgentApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/admin/agents';

    public function testGetPublishedAgents()
    {
        $uri = $this->baseUri . '/published?page_size=10&type=' . AgentFilterType::SELECTED_DEFAULT_FRIEND->value;
        $response = $this->get($uri, [], $this->getCommonHeaders());

        $this->assertSame(1000, $response['code']);
        $this->assertIsArray($response['data']);

        // 验证返回的数据结构
        $data = $response['data'];
        $this->assertArrayHasKey('page_token', $data);
        $this->assertArrayHasKey('has_more', $data);
        $this->assertArrayHasKey('items', $data);
    }
}
