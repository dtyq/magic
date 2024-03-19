<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\Agent;

use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsName;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Entity\ValueObject\Extra\PermissionRange;
use App\Domain\Admin\Entity\ValueObject\Item\Member\MemberType;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @coversNothing
 */
class AgentGlobalSettingsApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/admin/globals/agents';

    public function testUpdateGlobalSettings()
    {
        $uri = $this->baseUri . '/settings';
        $data = [
            AdminGlobalSettingsName::getByType(AdminGlobalSettingsType::DEFAULT_FRIEND) => [
                'type' => AdminGlobalSettingsType::DEFAULT_FRIEND->value,
                'status' => AdminGlobalSettingsStatus::ENABLED->value,
                'extra' => [
                    'selected_agent_ids' => ['test-id-1', 'test-id-2'],
                ],
            ],
            AdminGlobalSettingsName::getByType(AdminGlobalSettingsType::ASSISTANT_CREATE) => [
                'type' => AdminGlobalSettingsType::ASSISTANT_CREATE->value,
                'status' => AdminGlobalSettingsStatus::DISABLED->value,
                'extra' => [
                    'permission_range' => PermissionRange::SELECT->value,
                    'selected_members' => [
                        [
                            'member_type' => MemberType::USER->value,
                            'member_id' => 'usi_a450dd07688be6273b5ef112ad50ba7e',
                        ],
                        [
                            'member_type' => MemberType::DEPARTMENT->value,
                            'member_id' => '-1',
                        ],
                    ],
                ],
            ],
            AdminGlobalSettingsName::getByType(AdminGlobalSettingsType::THIRD_PARTY_PUBLISH) => [
                'type' => AdminGlobalSettingsType::THIRD_PARTY_PUBLISH->value,
                'status' => AdminGlobalSettingsStatus::DISABLED->value,
                'extra' => [
                    'permission_range' => PermissionRange::SELECT->value,
                    'selected_agents' => ['728641159917674496'],
                ],
            ],
        ];

        $response = $this->put($uri, $data, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $this->assertIsArray($response['data']);

        // 验证返回的数据结构
        foreach ($response['data'] as $setting) {
            $this->assertArrayHasKey('type', $setting);
            $this->assertArrayHasKey('status', $setting);
            $this->assertArrayHasKey('extra', $setting);
        }
    }

    public function testGetGlobalSettings()
    {
        $uri = $this->baseUri . '/settings';
        $response = $this->get($uri, [], $this->getCommonHeaders());

        $this->assertSame(1000, $response['code']);
        $this->assertIsArray($response['data']);

        // 验证返回的数据结构
        foreach ($response['data'] as $key => $setting) {
            $name = AdminGlobalSettingsName::tryFrom($key);
            self::assertInstanceOf(AdminGlobalSettingsName::class, $name);
            $this->assertArrayHasKey('type', $setting);
            $this->assertArrayHasKey('status', $setting);
            $this->assertArrayHasKey('extra', $setting);
        }
    }
}
