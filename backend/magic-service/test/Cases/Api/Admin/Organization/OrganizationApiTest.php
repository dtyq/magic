<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\Organization;

use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @coversNothing
 */
class OrganizationApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/admin/organizations';

    public function testOrganizationApiQueries(): void
    {
        $headers = $this->getCommonHeaders();
        $query = [
            'page' => 1,
            'page_size' => 10,
            'type' => 0,
        ];

        $response = $this->get($this->baseUri . '?' . http_build_query($query), [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertArrayHasKey('page', $data);
        $this->assertArrayHasKey('page_size', $data);
    }
}
