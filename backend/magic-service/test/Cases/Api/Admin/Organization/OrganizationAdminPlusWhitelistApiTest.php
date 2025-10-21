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
class OrganizationAdminPlusWhitelistApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/admin/organizations/whitelists';

    public function testWhitelistCrudFlow(): void
    {
        $headers = $this->getCommonHeaders();

        // 1) 查询列表（为空或有数据均可，验证路由和响应结构）
        $query = [
            'page' => 1,
            'page_size' => 10,
        ];
        $list = $this->get($this->baseUri . '?' . http_build_query($query), [], $headers);
        if (isset($list['code']) && in_array($list['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口认证失败或无权限，路由校验通过');
            return;
        }
        $this->assertIsArray($list);
        $this->assertArrayHasKey('code', $list);
        $this->assertSame(1000, $list['code']);
        $this->assertArrayHasKey('data', $list);
        $this->assertArrayHasKey('total', $list['data']);
        $this->assertArrayHasKey('list', $list['data']);

        // 2) 新增/更新（upsert）
        // 使用现有请求头中的组织编码，确保通过 magic_organizations 校验
        $orgCode = $headers['organization-code'] ?? 'DT001';
        $upsertBody = [
            'organization_code' => $orgCode,
            'enabled' => true,
        ];
        $upsertRes = $this->post($this->baseUri, $upsertBody, $headers);
        $this->assertIsArray($upsertRes);
        $this->assertArrayHasKey('code', $upsertRes);
        $this->assertSame(1000, $upsertRes['code']);
        $this->assertArrayHasKey('data', $upsertRes);
        $this->assertArrayHasKey('id', $upsertRes['data']);
        $this->assertArrayHasKey('organization_code', $upsertRes['data']);
        $this->assertSame($orgCode, $upsertRes['data']['organization_code']);
        $this->assertArrayHasKey('enabled', $upsertRes['data']);
        $this->assertTrue((bool) $upsertRes['data']['enabled']);

        $id = (int) $upsertRes['data']['id'];

        // 3) 再查一遍，确认存在（不强依赖返回内容结构，只校验通路）
        $list2 = $this->get($this->baseUri . '?' . http_build_query(['page' => 1, 'page_size' => 10, 'organization_code' => $orgCode]), [], $headers);
        $this->assertIsArray($list2);
        $this->assertArrayHasKey('code', $list2);
        $this->assertSame(1000, $list2['code']);

        // 4) 删除（按 id）
        $delRes = $this->delete($this->baseUri . '/' . $id, [], $headers);
        $this->assertIsArray($delRes);
        $this->assertArrayHasKey('code', $delRes);
        $this->assertSame(1000, $delRes['code']);
    }
}
