<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Agent;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Domain\Contact\Repository\Persistence\Model\UserSettingModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentMarketModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentVersionModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\UserAgentModel;
use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;

/**
 * @internal
 * Agent V2 API 补充测试：重点覆盖 MARKET 关系表语义
 */
class SuperMagicAgentApiV2Test extends AbstractApiTest
{
    private const BASE_URI = '/api/v2/super-magic/agents';

    public function testSortListQueriesOnlyReturnsPublishedCurrentVersions(): void
    {
        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();

        $frequentAgentCode = $this->createTestAgent();
        $allAgentCode = $this->createTestAgent();
        $hiddenAgentCode = $this->createTestAgent();
        $organizationCode = $headers['organization-code'];
        $userId = $headers['user-id'];
        $magicId = $headers['magic-id'];

        $frequentVersionId = IdGenerator::getSnowId();
        AgentVersionModel::query()->create([
            'id' => $frequentVersionId,
            'code' => $frequentAgentCode,
            'organization_code' => $organizationCode,
            'version' => '1.0.0',
            'name' => 'Frequent version',
            'description' => 'Frequent version',
            'icon' => [
                'type' => 'IconAccessibleFilled',
                'url' => '',
                'color' => '#4F46E5',
            ],
            'icon_type' => 1,
            'type' => 2,
            'enabled' => true,
            'prompt' => [],
            'tools' => [],
            'creator' => $userId,
            'modifier' => $userId,
            'name_i18n' => [
                'zh_CN' => '常用员工',
                'en_US' => 'Frequent Agent',
            ],
            'role_i18n' => [
                'zh_CN' => ['测试角色'],
                'en_US' => ['Tester'],
            ],
            'description_i18n' => [
                'zh_CN' => '常用员工描述',
                'en_US' => 'Frequent agent description',
            ],
            'publish_status' => PublishStatus::PUBLISHED->value,
            'review_status' => 'APPROVED',
            'publish_target_type' => 'PRIVATE',
            'publisher_user_id' => $userId,
            'published_at' => '2026-03-24 09:00:00',
            'is_current_version' => true,
            'created_at' => '2026-03-24 09:00:00',
            'updated_at' => '2026-03-24 09:00:00',
        ]);

        AgentVersionModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'code' => $hiddenAgentCode,
            'organization_code' => $organizationCode,
            'version' => '1.0.0',
            'name' => 'Hidden version',
            'description' => 'Hidden version',
            'icon' => [
                'type' => 'IconBookFilled',
                'url' => '',
                'color' => '#10B981',
            ],
            'icon_type' => 1,
            'type' => 2,
            'enabled' => true,
            'prompt' => [],
            'tools' => [],
            'creator' => $userId,
            'modifier' => $userId,
            'name_i18n' => [
                'zh_CN' => '未发布员工',
                'en_US' => 'Hidden Agent',
            ],
            'role_i18n' => [
                'zh_CN' => ['测试角色'],
                'en_US' => ['Tester'],
            ],
            'description_i18n' => [
                'zh_CN' => '未发布员工描述',
                'en_US' => 'Hidden agent description',
            ],
            'publish_status' => PublishStatus::UNPUBLISHED->value,
            'review_status' => 'APPROVED',
            'publish_target_type' => 'PRIVATE',
            'publisher_user_id' => $userId,
            'published_at' => null,
            'is_current_version' => true,
            'created_at' => '2026-03-25 09:00:00',
            'updated_at' => '2026-03-25 09:00:00',
        ]);

        $allVersionId = IdGenerator::getSnowId();
        AgentVersionModel::query()->create([
            'id' => $allVersionId,
            'code' => $allAgentCode,
            'organization_code' => $organizationCode,
            'version' => '1.0.0',
            'name' => 'All list version',
            'description' => 'All list version',
            'icon' => [
                'type' => 'IconTeamFilled',
                'url' => '',
                'color' => '#F59E0B',
            ],
            'icon_type' => 1,
            'type' => 2,
            'enabled' => true,
            'prompt' => [],
            'tools' => [],
            'creator' => $userId,
            'modifier' => $userId,
            'name_i18n' => [
                'zh_CN' => '全部列表员工',
                'en_US' => 'All List Agent',
            ],
            'role_i18n' => [
                'zh_CN' => ['测试角色'],
                'en_US' => ['Tester'],
            ],
            'description_i18n' => [
                'zh_CN' => '全部列表描述',
                'en_US' => 'All list description',
            ],
            'publish_status' => PublishStatus::PUBLISHED->value,
            'review_status' => 'APPROVED',
            'publish_target_type' => 'PRIVATE',
            'publisher_user_id' => $userId,
            'published_at' => '2026-03-25 10:00:00',
            'is_current_version' => true,
            'created_at' => '2026-03-25 10:00:00',
            'updated_at' => '2026-03-25 10:00:00',
        ]);

        UserSettingModel::query()->updateOrCreate(
            [
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'key' => UserSettingKey::SuperMagicAgentSort->value,
            ],
            [
                'magic_id' => $magicId,
                'value' => [
                    'frequent' => [$frequentAgentCode, $hiddenAgentCode],
                    'all' => [$frequentAgentCode, $hiddenAgentCode, $allAgentCode],
                ],
                'creator' => $userId,
                'modifier' => $userId,
                'created_at' => '2026-03-25 08:00:00',
                'updated_at' => '2026-03-25 08:00:00',
            ]
        );

        $response = $this->get(
            self::BASE_URI . '/featured/sort-list',
            [],
            $headers
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $this->assertSame(2, $response['data']['total']);
        $this->assertCount(1, $response['data']['frequent']);
        $this->assertCount(1, $response['data']['all']);

        $frequentItem = $response['data']['frequent'][0];
        $allItem = $response['data']['all'][0];

        $this->assertSame((string) $frequentVersionId, $frequentItem['id']);
        $this->assertSame('Frequent Agent', $frequentItem['name']);
        $this->assertArrayHasKey('logo', $frequentItem);
        $this->assertSame(['id', 'name', 'logo'], array_keys($frequentItem));

        $this->assertSame((string) $allVersionId, $allItem['id']);
        $this->assertSame('All List Agent', $allItem['name']);
        $this->assertSame(['id', 'name', 'logo'], array_keys($allItem));
        $this->assertNotContains('Hidden Agent', array_column($response['data']['frequent'], 'name'));
        $this->assertNotContains('Hidden Agent', array_column($response['data']['all'], 'name'));
    }

    public function testQueryAgentMarketUsesUserAgentOwnershipWithoutCreatingDuplicateLocalAgent(): void
    {
        $this->switchUserTest2();
        $publisherHeaders = $this->getCommonHeaders();
        $marketAgentCode = 'market_' . IdGenerator::getUniqueId32();
        $this->createPublishedAgentVersionRecord($marketAgentCode, '5.0.0', $publisherHeaders, true);

        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();

        $hireResponse = $this->post(
            '/api/v2/super-magic/agent-market/' . $marketAgentCode . '/hire',
            [],
            $headers
        );
        $this->assertEquals(1000, $hireResponse['code'], $hireResponse['message'] ?? '');

        $installedOwnership = UserAgentModel::query()
            ->where('organization_code', $headers['organization-code'])
            ->where('user_id', $headers['user-id'])
            ->where('agent_code', $marketAgentCode)
            ->first();
        $this->assertNotNull($installedOwnership);
        $this->assertSame('MARKET', $installedOwnership->source_type);

        $agentRowCount = SuperMagicAgentModel::query()
            ->where('organization_code', $headers['organization-code'])
            ->where('code', $marketAgentCode)
            ->count();
        $this->assertSame(1, $agentRowCount, '市场安装应复用原始 Agent code，不再创建重复主表记录');

        $response = $this->post(
            '/api/v2/super-magic/agent-market/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $marketItem = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['agent_code'] ?? null) === $marketAgentCode) {
                $marketItem = $item;
                break;
            }
        }

        $this->assertNotNull($marketItem, '应仍能通过用户关系表识别我已安装的市场 Agent');
        $this->assertTrue($marketItem['is_added']);
        $this->assertTrue($marketItem['allow_delete']);
        $this->assertSame($marketAgentCode, $marketItem['user_code']);
    }

    public function testExternalQueriesReturnsInstalledMarketAgentWhenStoreRecordOffline(): void
    {
        $this->switchUserTest2();
        $publisherHeaders = $this->getCommonHeaders();
        $marketAgentCode = 'market_' . IdGenerator::getUniqueId32();
        $this->createPublishedAgentVersionRecord($marketAgentCode, '6.0.0', $publisherHeaders, true);

        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();

        $hireResponse = $this->post(
            '/api/v2/super-magic/agent-market/' . $marketAgentCode . '/hire',
            [],
            $headers
        );
        $this->assertEquals(1000, $hireResponse['code'], $hireResponse['message'] ?? '');

        AgentMarketModel::query()
            ->where('agent_code', $marketAgentCode)
            ->update(['publish_status' => PublishStatus::OFFLINE->value]);

        $response = $this->post(
            self::BASE_URI . '/external/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $marketItem = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? null) === $marketAgentCode) {
                $marketItem = $item;
                break;
            }
        }

        $this->assertNotNull($marketItem, '市场安装的本地 Agent 即使市场记录已下架，也应继续出现在外部列表');
        $this->assertSame('MARKET', $marketItem['source_type']);
        $this->assertTrue($marketItem['allow_delete']);
        $this->assertTrue($marketItem['is_store_offline']);
        $this->assertSame('6.0.0', $marketItem['latest_version_code']);

        $detailResponse = $this->get(
            self::BASE_URI . '/' . $marketAgentCode,
            [],
            $headers
        );
        $this->assertEquals(1000, $detailResponse['code'], $detailResponse['message'] ?? '');
        $this->assertNull($detailResponse['data']['version_id']);
        $this->assertNull($detailResponse['data']['version_code']);
        $this->assertTrue($detailResponse['data']['is_store_offline']);
    }

    public function testDeleteOwnerAgentClearsAllUserAgentOwnerships(): void
    {
        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();
        $agentCode = $this->createTestAgent();

        UserAgentModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'organization_code' => $headers['organization-code'],
            'user_id' => env('TEST2_USER_ID'),
            'agent_code' => $agentCode,
            'agent_version_id' => null,
            'source_type' => 'LOCAL_CREATE',
            'source_id' => null,
        ]);

        $ownershipCountBeforeDelete = UserAgentModel::query()
            ->where('organization_code', $headers['organization-code'])
            ->where('agent_code', $agentCode)
            ->count();
        $this->assertGreaterThanOrEqual(2, $ownershipCountBeforeDelete, '删除前应存在 owner 和额外用户关系');

        $deleteResponse = $this->delete(
            self::BASE_URI . '/' . $agentCode,
            [],
            $headers
        );
        $this->assertEquals(1000, $deleteResponse['code'], $deleteResponse['message'] ?? '');

        $ownershipCountAfterDelete = UserAgentModel::query()
            ->where('organization_code', $headers['organization-code'])
            ->where('agent_code', $agentCode)
            ->count();
        $this->assertSame(0, $ownershipCountAfterDelete, 'owner 删除本地 Agent 后应清理所有用户关系');
    }

    private function createTestAgent(): string
    {
        $requestData = [
            'name_i18n' => [
                'zh_CN' => '测试员工',
                'en_US' => 'Test Agent',
            ],
            'role_i18n' => [
                'zh_CN' => ['市场分析师'],
                'en_US' => ['Marketing Analyst'],
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个测试员工',
                'en_US' => 'This is a test agent',
            ],
            'icon' => [
                'type' => 'IconAccessibleFilled',
                'url' => '',
                'color' => '#4F46E5',
            ],
            'icon_type' => 1,
            'prompt_shadow' => '',
        ];

        $response = $this->post(
            self::BASE_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);
        $agentId = $response['data']['id'] ?? null;
        $this->assertNotNull($agentId, 'agent_id 不应为空');

        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $agent = SuperMagicAgentModel::query()
            ->where('code', $agentId)
            ->where('organization_code', $organizationCode)
            ->first();

        $this->assertNotNull($agent, '应该创建了员工记录');
        $this->assertNotNull($agent->code, 'agent_code 不应为空');

        return $agent->code;
    }

    private function createPublishedAgentVersionRecord(
        string $agentCode,
        string $version,
        array $headers,
        bool $withMarketRecord = false
    ): int {
        $organizationCode = $headers['organization-code'];
        $userId = $headers['user-id'];
        $versionId = IdGenerator::getSnowId();
        $publishedAt = date('Y-m-d H:i:s');

        AgentVersionModel::query()->create([
            'id' => $versionId,
            'code' => $agentCode,
            'organization_code' => $organizationCode,
            'version' => $version,
            'name' => 'Published Agent',
            'description' => 'Published agent for test',
            'icon' => [
                'type' => 'IconAccessibleFilled',
                'url' => '',
                'color' => '#4F46E5',
            ],
            'icon_type' => 1,
            'type' => 2,
            'enabled' => true,
            'prompt' => [],
            'tools' => [],
            'creator' => $userId,
            'modifier' => $userId,
            'name_i18n' => [
                'zh_CN' => '测试发布员工',
                'en_US' => 'Published Test Agent',
            ],
            'role_i18n' => [
                'zh_CN' => ['测试角色'],
                'en_US' => ['Tester'],
            ],
            'description_i18n' => [
                'zh_CN' => '测试发布员工描述',
                'en_US' => 'Published test agent description',
            ],
            'publish_status' => PublishStatus::PUBLISHED->value,
            'review_status' => 'APPROVED',
            'publish_target_type' => $withMarketRecord ? 'MARKET' : 'PRIVATE',
            'publisher_user_id' => $userId,
            'published_at' => $publishedAt,
            'is_current_version' => true,
            'created_at' => $publishedAt,
            'updated_at' => $publishedAt,
        ]);

        if ($withMarketRecord) {
            AgentMarketModel::query()->create([
                'id' => IdGenerator::getSnowId(),
                'agent_code' => $agentCode,
                'agent_version_id' => $versionId,
                'name_i18n' => [
                    'zh_CN' => '市场员工',
                    'en_US' => 'Market Agent',
                ],
                'role_i18n' => [
                    'zh_CN' => ['测试角色'],
                    'en_US' => ['Tester'],
                ],
                'description_i18n' => [
                    'zh_CN' => '市场员工描述',
                    'en_US' => 'Market agent description',
                ],
                'icon' => [
                    'type' => 'IconAccessibleFilled',
                    'url' => '',
                    'color' => '#4F46E5',
                ],
                'publish_status' => PublishStatus::PUBLISHED->value,
                'publisher_id' => $userId,
                'publisher_type' => 'USER',
                'organization_code' => $organizationCode,
                'created_at' => $publishedAt,
                'updated_at' => $publishedAt,
            ]);
        }

        return $versionId;
    }
}
