<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Agent;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Repository\Persistence\Model\ResourceVisibilityModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentCategoryModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentMarketModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentPlaybookModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentSkillModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentVersionModel;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillModel;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillVersionModel;
use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;

/**
 * @internal
 * 员工（Agent）V2 API测试
 */
class SuperMagicAgentApiTest extends AbstractApiTest
{
    private const BASE_URI = '/api/v2/super-magic/agents';

    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
    }

    /**
     * 测试创建员工.
     */
    public function testCreateAgent(): void
    {
        $this->switchUserTest1();

        $requestData = [
            'name_i18n' => [
                'zh_CN' => '测试员工',
                'en_US' => 'Test Agent',
            ],
            'role_i18n' => [
                'zh_CN' => ['市场分析师', '内容创作者'],
                'en_US' => ['Marketing Analyst', 'Content Creator'],
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个测试员工',
                'en_US' => 'This is a test agent',
            ],
            'icon' => [
                'url' => 'https://xxx.com/DT001/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/KZ9gYHxKikDWCQHikAlri.svg',
            ],
            'icon_type' => 2,
            'prompt_shadow' => '',
        ];

        $response = $this->post(
            self::BASE_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('id', $response['data']);
        $this->assertIsString($response['data']['id']);

        $code = $response['data']['code'];

        $response = $this->get(
            self::BASE_URI . '/' . $response['data']['code'],
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('id', $response['data']);
        $this->assertIsString($response['data']['id']);
        $this->assertEquals($response['data']['name'], $requestData['name_i18n']['en_US']);
        $this->assertEquals($response['data']['description'], $requestData['description_i18n']['en_US']);
        $this->assertEquals($response['data']['name_i18n']['zh_CN'], $requestData['name_i18n']['zh_CN']);
        $this->assertEquals($response['data']['name_i18n']['en_US'], $requestData['name_i18n']['en_US']);
        $this->assertEquals($response['data']['role_i18n']['zh_CN'], $requestData['role_i18n']['zh_CN']);
        $this->assertEquals($response['data']['role_i18n']['en_US'], $requestData['role_i18n']['en_US']);
        $this->assertEquals($response['data']['description_i18n']['zh_CN'], $requestData['description_i18n']['zh_CN']);
        $this->assertEquals($response['data']['description_i18n']['en_US'], $requestData['description_i18n']['en_US']);
        $this->assertEquals($response['data']['icon']['url'], $requestData['icon']['url']);
        $this->assertEquals($response['data']['icon_type'], 2);
        $this->assertArrayHasKey('file_key', $response['data']);
        $this->assertArrayHasKey('latest_published_at', $response['data']);
        $this->assertNull($response['data']['file_key']);
        $this->assertNull($response['data']['latest_published_at']);

        $response = $this->delete(
            self::BASE_URI . '/' . $code,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);

        $response = $this->get(
            self::BASE_URI . '/' . $code,
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $response['code'], $response['message'] ?? '');
    }

    /**
     * 测试查询员工列表.
     */
    public function testQueryAgents(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();
        SuperMagicAgentModel::query()->where('code', $agentCode)->update(['file_key' => 'agents/original.zip']);

        // 测试基本查询
        $queryData = [
            'page' => 1,
            'page_size' => 20,
        ];
        $response = $this->post(
            self::BASE_URI . '/queries',
            $queryData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('total', $response['data']);
        $this->assertArrayHasKey('list', $response['data']);
        $this->assertArrayHasKey('page', $response['data']);
        $this->assertArrayHasKey('page_size', $response['data']);
        $this->assertIsInt($response['data']['total']);
        $this->assertIsArray($response['data']['list']);
        $this->assertGreaterThanOrEqual(1, $response['data']['total']);

        // 验证列表项结构
        if (count($response['data']['list']) > 0) {
            $item = $response['data']['list'][0];
            $this->assertArrayHasKey('id', $item);
            $this->assertArrayHasKey('code', $item);
            $this->assertArrayHasKey('name_i18n', $item);
            $this->assertArrayHasKey('role_i18n', $item);
            $this->assertArrayHasKey('description_i18n', $item);
            $this->assertArrayHasKey('icon', $item);
            $this->assertArrayHasKey('icon_type', $item);
            $this->assertArrayHasKey('playbooks', $item);
            $this->assertArrayHasKey('source_type', $item);
            $this->assertArrayHasKey('enabled', $item);
            $this->assertArrayHasKey('is_store_offline', $item);
            $this->assertArrayHasKey('need_upgrade', $item);
            $this->assertArrayHasKey('latest_version_code', $item);
            $this->assertArrayHasKey('allow_delete', $item);
            $this->assertArrayHasKey('pinned_at', $item);
            $this->assertArrayHasKey('latest_published_at', $item);
            $this->assertArrayHasKey('updated_at', $item);
            $this->assertArrayHasKey('created_at', $item);
        }

        // 测试关键词搜索（中文）
        $keywordQueryData = [
            'page' => 1,
            'page_size' => 20,
            'keyword' => 'Test',
        ];
        $keywordResponse = $this->post(
            self::BASE_URI . '/queries',
            $keywordQueryData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $keywordResponse['code']);
        $this->assertGreaterThanOrEqual(1, $keywordResponse['data']['total']);

        // 测试关键词搜索（英文）
        $keywordEnQueryData = [
            'page' => 1,
            'page_size' => 20,
            'keyword' => 'Test',
        ];
        $keywordEnResponse = $this->post(
            self::BASE_URI . '/queries',
            $keywordEnQueryData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $keywordEnResponse['code']);
        $this->assertIsInt($keywordEnResponse['data']['total']);

        // 测试分页
        $pageQueryData = [
            'page' => 1,
            'page_size' => 1,
        ];
        $pageResponse = $this->post(
            self::BASE_URI . '/queries',
            $pageQueryData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $pageResponse['code']);
        $this->assertLessThanOrEqual(1, count($pageResponse['data']['list']));
        $this->assertEquals(1, $pageResponse['data']['page']);
        $this->assertEquals(1, $pageResponse['data']['page_size']);

        $response = $this->delete(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
    }

    public function testQueryAgentsOnlyReturnsLocalCreateAgents(): void
    {
        $this->switchUserTest2();
        $publisherHeaders = $this->getCommonHeaders();
        $marketAgentCode = 'market_' . IdGenerator::getUniqueId32();
        $this->createPublishedAgentVersionRecord($marketAgentCode, '9.9.9', $publisherHeaders, true);

        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();
        $localAgentCode = $this->createTestAgent();

        $publishResponse = $this->post(
            self::BASE_URI . '/' . $localAgentCode . '/publish',
            [
                'version' => '1.0.0',
                'version_description_i18n' => [
                    'zh_CN' => '首个版本',
                    'en_US' => 'First version',
                ],
                'publish_target_type' => 'PRIVATE',
            ],
            $headers
        );
        $this->assertEquals(1000, $publishResponse['code'], $publishResponse['message'] ?? '');

        $hireResponse = $this->post(
            '/api/v2/super-magic/agent-market/' . $marketAgentCode . '/hire',
            [],
            $headers
        );
        $this->assertEquals(1000, $hireResponse['code'], $hireResponse['message'] ?? '');

        $hiredMarketAgent = SuperMagicAgentModel::query()
            ->where('organization_code', $headers['organization-code'])
            ->where('creator', $headers['user-id'])
            ->where('version_code', $marketAgentCode)
            ->first();
        $this->assertNotNull($hiredMarketAgent);

        $response = $this->post(
            self::BASE_URI . '/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $codes = array_column($response['data']['list'], 'code');
        $this->assertContains($localAgentCode, $codes);
        $this->assertNotContains($hiredMarketAgent->code, $codes);
        $this->assertSame(
            ['LOCAL_CREATE'],
            array_values(array_unique(array_column($response['data']['list'], 'source_type')))
        );

        $localItem = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? null) === $localAgentCode) {
                $localItem = $item;
                break;
            }
        }

        $this->assertNotNull($localItem);
        $this->assertEquals('LOCAL_CREATE', $localItem['source_type']);
        $this->assertEquals('1.0.0', $localItem['latest_version_code']);
        $this->assertTrue($localItem['allow_delete']);
        $this->assertFalse($localItem['need_upgrade']);
    }

    public function testQueryExternalAgents(): void
    {
        $this->switchUserTest2();
        $publisherHeaders = $this->getCommonHeaders();
        $marketAgentCode = 'market_' . IdGenerator::getUniqueId32();
        $this->createPublishedAgentVersionRecord($marketAgentCode, '2.5.0', $publisherHeaders, true);
        $sharedAgentCode = $this->createTestAgent();

        $publishSharedResponse = $this->post(
            self::BASE_URI . '/' . $sharedAgentCode . '/publish',
            [
                'version' => '3.1.0',
                'version_description_i18n' => [
                    'zh_CN' => '共享版本',
                    'en_US' => 'Shared version',
                ],
                'publish_target_type' => 'PRIVATE',
            ],
            $publisherHeaders
        );
        $this->assertEquals(1000, $publishSharedResponse['code'], $publishSharedResponse['message'] ?? '');

        $this->shareAgentWithUser($sharedAgentCode, $publisherHeaders['user-id'], env('TEST1_USER_ID'));

        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();
        $hireResponse = $this->post(
            '/api/v2/super-magic/agent-market/' . $marketAgentCode . '/hire',
            [],
            $headers
        );
        $this->assertEquals(1000, $hireResponse['code'], $hireResponse['message'] ?? '');

        $hiredMarketAgent = SuperMagicAgentModel::query()
            ->where('organization_code', $headers['organization-code'])
            ->where('creator', $headers['user-id'])
            ->where('version_code', $marketAgentCode)
            ->first();
        $this->assertNotNull($hiredMarketAgent);

        $response = $this->post(
            self::BASE_URI . '/external/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertGreaterThanOrEqual(2, $response['data']['total']);

        $sharedItem = null;
        $marketItem = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? null) === $sharedAgentCode) {
                $sharedItem = $item;
            }
            if (($item['code'] ?? null) === $hiredMarketAgent->code) {
                $marketItem = $item;
            }
        }

        $this->assertNotNull($sharedItem, '应该返回别人发布给我的员工');
        $this->assertEquals('LOCAL_CREATE', $sharedItem['source_type']);
        $this->assertEquals('3.1.0', $sharedItem['latest_version_code']);
        $this->assertFalse($sharedItem['allow_delete']);

        $this->assertNotNull($marketItem, '应该返回从市场添加的员工');
        $this->assertEquals('MARKET', $marketItem['source_type']);
        $this->assertEquals('2.5.0', $marketItem['latest_version_code']);
        $this->assertTrue($marketItem['allow_delete']);
    }

    public function testQueryAgentMarketReturnsLatestVersionAndAllowDelete(): void
    {
        $this->switchUserTest2();
        $publisherHeaders = $this->getCommonHeaders();
        $marketAgentCode = 'market_' . IdGenerator::getUniqueId32();
        $this->createPublishedAgentVersionRecord($marketAgentCode, '4.2.0', $publisherHeaders, true);

        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();

        $beforeHireResponse = $this->post(
            '/api/v2/super-magic/agent-market/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );
        $this->assertEquals(1000, $beforeHireResponse['code'], $beforeHireResponse['message'] ?? '');

        $marketItem = null;
        foreach ($beforeHireResponse['data']['list'] as $item) {
            if (($item['agent_code'] ?? null) === $marketAgentCode) {
                $marketItem = $item;
                break;
            }
        }

        $this->assertNotNull($marketItem);
        $this->assertFalse($marketItem['is_added']);
        $this->assertEquals('4.2.0', $marketItem['latest_version_code']);
        $this->assertFalse($marketItem['allow_delete']);
        $this->assertArrayNotHasKey('need_upgrade', $marketItem);

        $hireResponse = $this->post(
            '/api/v2/super-magic/agent-market/' . $marketAgentCode . '/hire',
            [],
            $headers
        );
        $this->assertEquals(1000, $hireResponse['code'], $hireResponse['message'] ?? '');

        $afterHireResponse = $this->post(
            '/api/v2/super-magic/agent-market/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );
        $this->assertEquals(1000, $afterHireResponse['code'], $afterHireResponse['message'] ?? '');

        $marketItemAfterHire = null;
        foreach ($afterHireResponse['data']['list'] as $item) {
            if (($item['agent_code'] ?? null) === $marketAgentCode) {
                $marketItemAfterHire = $item;
                break;
            }
        }

        $this->assertNotNull($marketItemAfterHire);
        $this->assertTrue($marketItemAfterHire['is_added']);
        $this->assertTrue($marketItemAfterHire['allow_delete']);
        $this->assertEquals('4.2.0', $marketItemAfterHire['latest_version_code']);
    }

    /**
     * 测试更新员工基本信息.
     */
    public function testUpdateAgentInfo(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();
        SuperMagicAgentModel::query()->where('code', $agentCode)->update(['file_key' => 'agents/original.zip']);

        // 更新员工信息
        $updateData = [
            'name_i18n' => [
                'zh_CN' => '更新后的员工名称',
                'en_US' => 'Updated Agent Name',
            ],
            'role_i18n' => [
                'zh_CN' => ['更新后的角色'],
                'en_US' => ['Updated Role'],
            ],
            'description_i18n' => [
                'zh_CN' => '更新后的员工描述',
                'en_US' => 'Updated Agent Description',
            ],
            'icon' => [
                'type' => 'IconAccessibleFilled',
                'url' => '',
                'color' => '#10B981',
            ],
            'icon_type' => 1,
            'prompt_shadow' => '',
        ];

        $response = $this->put(
            self::BASE_URI . '/' . $agentCode,
            $updateData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);

        // 验证更新是否生效：获取员工详情
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertEquals('更新后的员工名称', $detailData['name_i18n']['zh_CN']);
        $this->assertEquals('Updated Agent Name', $detailData['name_i18n']['en_US']);
        $this->assertEquals('agents/original.zip', $detailData['file_key']);

        $updateWithFileKey = $updateData;
        $updateWithFileKey['file_key'] = 'agents/updated.zip';
        $response = $this->put(
            self::BASE_URI . '/' . $agentCode,
            $updateWithFileKey,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $this->assertEquals('agents/updated.zip', $detailResponse['data']['file_key']);

        // 测试更新不存在的员工
        $notFoundResponse = $this->put(
            self::BASE_URI . '/non_existent_agent_code_12345',
            $updateData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的员工应该返回错误');

        $response = $this->delete(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
    }

    /**
     * 测试获取员工详情.
     */
    public function testGetAgentDetail(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();

        // 获取员工详情
        $response = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $data = $response['data'];

        // 验证返回字段
        $this->assertArrayHasKey('id', $data);
        $this->assertArrayHasKey('code', $data);
        $this->assertArrayHasKey('version_code', $data);
        $this->assertArrayHasKey('version_id', $data);
        $this->assertArrayHasKey('name_i18n', $data);
        $this->assertArrayHasKey('role_i18n', $data);
        $this->assertArrayHasKey('description_i18n', $data);
        $this->assertArrayHasKey('icon', $data);
        $this->assertArrayHasKey('icon_type', $data);
        $this->assertArrayHasKey('prompt', $data);
        $this->assertArrayHasKey('enabled', $data);
        $this->assertArrayHasKey('source_type', $data);
        $this->assertArrayHasKey('is_store_offline', $data);
        $this->assertArrayHasKey('pinned_at', $data);
        $this->assertArrayHasKey('skills', $data);
        $this->assertArrayHasKey('playbooks', $data);
        $this->assertArrayHasKey('latest_published_at', $data);
        $this->assertArrayHasKey('created_at', $data);
        $this->assertArrayHasKey('updated_at', $data);
        $this->assertArrayHasKey('file_key', $data);
        $this->assertArrayNotHasKey('file_url', $data);

        // 验证字段类型和值
        $this->assertIsString($data['id']);
        $this->assertEquals($agentCode, $data['code']);
        $this->assertEquals('LOCAL_CREATE', $data['source_type']);
        $this->assertIsBool($data['enabled']);
        $this->assertIsArray($data['name_i18n']);
        $this->assertIsArray($data['skills']);
        $this->assertIsArray($data['playbooks']);
        $this->assertNull($data['latest_published_at']);

        // 测试不存在的员工
        $notFoundResponse = $this->get(
            self::BASE_URI . '/non_existent_agent_code_12345',
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的员工应该返回错误');

        $response = $this->delete(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
    }

    /**
     * 测试创建员工 Playbook.
     */
    public function testCreatePlaybook(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();

        // 创建 Playbook
        $playbookData = [
            'name_i18n' => [
                'zh_CN' => '周报生成',
                'en_US' => 'Weekly Report',
            ],
            'description_i18n' => [
                'zh_CN' => '自动生成周报的工作流',
                'en_US' => 'Workflow for automatically generating weekly reports',
            ],
            'icon' => '📊',
            'theme_color' => '#4F46E5',
            'enabled' => true,
            'sort_order' => 0,
            'config' => [
                'scenes_config' => [
                    'scene1' => [
                        'name' => '数据收集',
                        'steps' => [],
                    ],
                ],
                'presets_config' => [
                    'style' => 'formal',
                    'language' => 'zh',
                ],
                'quick_starts_config' => [
                    '生成本周周报',
                    '生成月度报告',
                ],
            ],
        ];

        $response = $this->post(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            $playbookData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);

        // 验证 Playbook 已创建：获取员工详情，检查 playbooks
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertIsArray($detailData['playbooks']);
        $this->assertGreaterThanOrEqual(1, count($detailData['playbooks']));

        // 验证 Playbook 数据
        $playbook = $detailData['playbooks'][0];
        $this->assertArrayHasKey('name_i18n', $playbook);
        $this->assertArrayHasKey('icon', $playbook);
        $this->assertArrayHasKey('theme_color', $playbook);
        $this->assertEquals('周报生成', $playbook['name_i18n']['zh_CN']);
        $this->assertEquals('Weekly Report', $playbook['name_i18n']['en_US']);
        $this->assertEquals('📊', $playbook['icon']);
        $this->assertEquals('#4F46E5', $playbook['theme_color']);

        // 测试为不存在的员工创建 Playbook
        $notFoundResponse = $this->post(
            self::BASE_URI . '/non_existent_agent_code_12345/playbooks',
            $playbookData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的员工应该返回错误');
    }

    /**
     * 测试更新员工 Playbook.
     */
    public function testUpdatePlaybook(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工和 Playbook 作为测试数据
        $agentCode = $this->createTestAgent();
        $playbookId = $this->createTestPlaybook($agentCode);

        // 更新 Playbook
        $updateData = [
            'name_i18n' => [
                'zh_CN' => '更新后的周报生成',
                'en_US' => 'Updated Weekly Report',
            ],
            'description_i18n' => [
                'zh_CN' => '更新后的工作流描述',
                'en_US' => 'Updated workflow description',
            ],
            'icon' => '📈',
            'theme_color' => '#10B981',
            'enabled' => false,
            'sort_order' => 10,
        ];

        $response = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/' . $playbookId,
            $updateData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertEmpty($response['data'], '更新成功应返回空数组');

        // 验证更新是否生效：获取员工详情，检查 playbooks
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertIsArray($detailData['playbooks']);

        // 查找更新后的 Playbook
        $found = false;
        foreach ($detailData['playbooks'] as $playbook) {
            if ($playbook['name_i18n']['zh_CN'] === '更新后的周报生成') {
                $found = true;
                $this->assertEquals('📈', $playbook['icon']);
                $this->assertEquals('#10B981', $playbook['theme_color']);
                break;
            }
        }
        $this->assertTrue($found, '应该找到更新后的 Playbook');

        // 测试部分更新（只更新 name_i18n）
        $partialUpdateData = [
            'name_i18n' => [
                'zh_CN' => '部分更新的周报生成',
                'en_US' => 'Partially Updated Weekly Report',
            ],
        ];
        $partialResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/' . $playbookId,
            $partialUpdateData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $partialResponse['code']);

        // 测试更新不存在的 Playbook
        $notFoundResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/999999',
            $updateData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的 Playbook 应该返回错误');
    }

    /**
     * 测试删除员工 Playbook.
     */
    public function testDeletePlaybook(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工和 Playbook 作为测试数据
        $agentCode = $this->createTestAgent();
        $playbookId = $this->createTestPlaybook($agentCode);

        // 删除 Playbook
        $response = $this->delete(
            self::BASE_URI . '/' . $agentCode . '/playbooks/' . $playbookId,
            [],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertEmpty($response['data'], '删除成功应返回空数组');

        // 验证 Playbook 已被删除：获取员工详情，检查 playbooks 中不应包含该 Playbook
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertIsArray($detailData['playbooks']);

        // 验证 Playbook 不在列表中（因为软删除后，enabled=1 的查询不会返回）
        $found = false;
        foreach ($detailData['playbooks'] as $playbook) {
            if (isset($playbook['id']) && $playbook['id'] === $playbookId) {
                $found = true;
                break;
            }
        }
        $this->assertFalse($found, '已删除的 Playbook 不应出现在列表中');

        // 测试删除不存在的 Playbook
        $notFoundResponse = $this->delete(
            self::BASE_URI . '/' . $agentCode . '/playbooks/999999',
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的 Playbook 应该返回错误');
    }

    /**
     * 测试切换 Playbook 启用/禁用状态.
     */
    public function testTogglePlaybookEnabled(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工和 Playbook 作为测试数据
        $agentCode = $this->createTestAgent();
        $playbookId = $this->createTestPlaybook($agentCode);

        // 测试禁用 Playbook
        $disableResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/' . $playbookId . '/enabled',
            ['enabled' => false],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $disableResponse['code'], $disableResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $disableResponse);
        $this->assertIsArray($disableResponse['data']);

        // 验证 Playbook 已被禁用：获取员工详情，检查 playbooks 中该 Playbook 的 enabled 状态
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertIsArray($detailData['playbooks']);

        $found = false;
        foreach ($detailData['playbooks'] as $playbook) {
            if (isset($playbook['id']) && (int) $playbook['id'] === $playbookId) {
                $found = true;
                $this->assertFalse($playbook['enabled'], 'Playbook 应该已被禁用');
                break;
            }
        }
        $this->assertTrue($found, 'Playbook 应该存在于列表中');

        // 测试启用 Playbook
        $enableResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/' . $playbookId . '/enabled',
            ['enabled' => true],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $enableResponse['code'], $enableResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $enableResponse);
        $this->assertIsArray($enableResponse['data']);

        // 验证 Playbook 已被启用
        $detailResponse2 = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse2['code']);
        $detailData2 = $detailResponse2['data'];
        $this->assertIsArray($detailData2['playbooks']);

        $found2 = false;
        foreach ($detailData2['playbooks'] as $playbook) {
            if (isset($playbook['id']) && (int) $playbook['id'] === $playbookId) {
                $found2 = true;
                $this->assertTrue($playbook['enabled'], 'Playbook 应该已被启用');
                break;
            }
        }
        $this->assertTrue($found2, 'Playbook 应该存在于列表中');

        // 测试切换不存在的 Playbook
        $notFoundResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/999999/enabled',
            ['enabled' => true],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的 Playbook 应该返回错误');
    }

    /**
     * 测试更新员工绑定的技能列表（全量更新）.
     */
    public function testUpdateAgentSkills(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();

        // 创建测试技能
        $skill1Code = $this->createTestSkillCode();
        $skill2Code = $this->createTestSkillCode();

        // 更新员工绑定的技能列表
        $updateData = [
            'skill_codes' => [$skill1Code, $skill2Code],
        ];

        $response = $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $updateData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertEmpty($response['data'], '更新成功应返回空数组');

        // 验证技能已绑定：获取员工详情，检查 skills
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertIsArray($detailData['skills']);
        $this->assertCount(2, $detailData['skills'], '应该绑定了2个技能');

        // 验证技能顺序（sort_order）
        $this->assertEquals($skill1Code, $detailData['skills'][0]['skill_code'], '第一个技能应该是 skill1');
        $this->assertEquals($skill2Code, $detailData['skills'][1]['skill_code'], '第二个技能应该是 skill2');

        // 测试清空技能列表（传入空数组）
        $emptyUpdateData = [
            'skill_codes' => [],
        ];
        $emptyResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $emptyUpdateData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $emptyResponse['code']);

        // 验证技能列表已清空
        $emptyDetailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $emptyDetailResponse['code']);
        $emptyDetailData = $emptyDetailResponse['data'];
        $this->assertIsArray($emptyDetailData['skills']);
        $this->assertCount(0, $emptyDetailData['skills'], '技能列表应该已清空');

        // 测试更新不存在的员工
        $notFoundResponse = $this->put(
            self::BASE_URI . '/non_existent_agent_code_12345/skills',
            $updateData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的员工应该返回错误');

        // 测试重复的技能 code
        $duplicateData = [
            'skill_codes' => [$skill1Code, $skill1Code], // 重复的 code
        ];
        $duplicateResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $duplicateData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $duplicateResponse['code'], '重复的技能 code 应该返回错误');
    }

    /**
     * 测试新增员工绑定的技能（增量添加）.
     */
    public function testAddAgentSkills(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();

        // 创建测试技能
        $skill1Code = $this->createTestSkillCode();
        $skill2Code = $this->createTestSkillCode();
        $skill3Code = $this->createTestSkillCode();

        // 先绑定 skill1 和 skill2
        $initialData = [
            'skill_codes' => [$skill1Code, $skill2Code],
        ];
        $initialResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $initialData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $initialResponse['code']);

        // 验证初始技能已绑定
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertCount(2, $detailData['skills'], '应该绑定了2个技能');

        // 新增 skill3
        $addData = [
            'skill_codes' => [$skill3Code],
        ];
        $addResponse = $this->post(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $addData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $addResponse['code'], $addResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $addResponse);
        $this->assertIsArray($addResponse['data']);
        $this->assertEmpty($addResponse['data'], '新增成功应返回空数组');

        // 验证技能已新增：获取员工详情，检查 skills
        $afterAddResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterAddResponse['code']);
        $afterAddData = $afterAddResponse['data'];
        $this->assertIsArray($afterAddData['skills']);
        $this->assertCount(3, $afterAddData['skills'], '应该绑定了3个技能');

        // 验证技能顺序：原有的在前，新增的在后
        $skillCodes = array_column($afterAddData['skills'], 'skill_code');
        $this->assertContains($skill1Code, $skillCodes, '应该包含 skill1');
        $this->assertContains($skill2Code, $skillCodes, '应该包含 skill2');
        $this->assertContains($skill3Code, $skillCodes, '应该包含 skill3');

        // 测试重复添加已存在的技能（应该被跳过）
        $duplicateAddData = [
            'skill_codes' => [$skill1Code], // 已存在的技能
        ];
        $duplicateAddResponse = $this->post(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $duplicateAddData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $duplicateAddResponse['code']);

        // 验证技能数量没有增加（去重）
        $afterDuplicateResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterDuplicateResponse['code']);
        $afterDuplicateData = $afterDuplicateResponse['data'];
        $this->assertCount(3, $afterDuplicateData['skills'], '技能数量应该仍然是3个（去重）');

        // 测试批量新增多个技能
        $skill4Code = $this->createTestSkillCode();
        $skill5Code = $this->createTestSkillCode();
        $batchAddData = [
            'skill_codes' => [$skill4Code, $skill5Code],
        ];
        $batchAddResponse = $this->post(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $batchAddData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $batchAddResponse['code']);

        // 验证批量新增成功
        $afterBatchResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterBatchResponse['code']);
        $afterBatchData = $afterBatchResponse['data'];
        $this->assertCount(5, $afterBatchData['skills'], '应该绑定了5个技能');

        // 测试新增不存在的技能
        $invalidAddData = [
            'skill_codes' => ['non_existent_skill_code_12345'],
        ];
        $invalidAddResponse = $this->post(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $invalidAddData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $invalidAddResponse['code'], '不存在的技能应该返回错误');
    }

    /**
     * 测试删除员工绑定的技能（增量删除）.
     */
    public function testRemoveAgentSkills(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();

        // 创建测试技能
        $skill1Code = $this->createTestSkillCode();
        $skill2Code = $this->createTestSkillCode();
        $skill3Code = $this->createTestSkillCode();
        $skill4Code = $this->createTestSkillCode();

        // 先绑定所有技能
        $initialData = [
            'skill_codes' => [$skill1Code, $skill2Code, $skill3Code, $skill4Code],
        ];
        $initialResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $initialData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $initialResponse['code']);

        // 验证初始技能已绑定
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertCount(4, $detailData['skills'], '应该绑定了4个技能');

        // 删除 skill1
        $removeData = [
            'skill_codes' => [$skill1Code],
        ];
        $removeResponse = $this->delete(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $removeData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $removeResponse['code'], $removeResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $removeResponse);
        $this->assertIsArray($removeResponse['data']);
        $this->assertEmpty($removeResponse['data'], '删除成功应返回空数组');

        // 验证技能已删除：获取员工详情，检查 skills
        $afterRemoveResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterRemoveResponse['code']);
        $afterRemoveData = $afterRemoveResponse['data'];
        $this->assertIsArray($afterRemoveData['skills']);
        $this->assertCount(3, $afterRemoveData['skills'], '应该还剩3个技能');

        // 验证 skill1 已被删除
        $skillCodes = array_column($afterRemoveData['skills'], 'skill_code');
        $this->assertNotContains($skill1Code, $skillCodes, 'skill1 应该已被删除');
        $this->assertContains($skill2Code, $skillCodes, '应该包含 skill2');
        $this->assertContains($skill3Code, $skillCodes, '应该包含 skill3');
        $this->assertContains($skill4Code, $skillCodes, '应该包含 skill4');

        // 测试批量删除多个技能
        $batchRemoveData = [
            'skill_codes' => [$skill2Code, $skill3Code],
        ];
        $batchRemoveResponse = $this->delete(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $batchRemoveData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $batchRemoveResponse['code']);

        // 验证批量删除成功
        $afterBatchRemoveResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterBatchRemoveResponse['code']);
        $afterBatchRemoveData = $afterBatchRemoveResponse['data'];
        $this->assertCount(1, $afterBatchRemoveData['skills'], '应该还剩1个技能');
        $this->assertEquals($skill4Code, $afterBatchRemoveData['skills'][0]['skill_code'], '应该只剩 skill4');

        // 测试删除不存在的技能（应该成功，不影响其他技能）
        $invalidRemoveData = [
            'skill_codes' => ['non_existent_skill_code_12345'],
        ];
        $invalidRemoveResponse = $this->delete(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $invalidRemoveData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(60002, $invalidRemoveResponse['code']);

        // 验证技能数量没有变化
        $afterInvalidRemoveResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterInvalidRemoveResponse['code']);
        $afterInvalidRemoveData = $afterInvalidRemoveResponse['data'];
        $this->assertCount(1, $afterInvalidRemoveData['skills'], '技能数量应该仍然是1个');

        // 测试删除所有技能
        $removeAllData = [
            'skill_codes' => [$skill4Code],
        ];
        $removeAllResponse = $this->delete(
            self::BASE_URI . '/' . $agentCode . '/skills',
            $removeAllData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $removeAllResponse['code']);

        // 验证所有技能已删除
        $afterRemoveAllResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $afterRemoveAllResponse['code']);
        $afterRemoveAllData = $afterRemoveAllResponse['data'];
        $this->assertCount(0, $afterRemoveAllData['skills'], '技能列表应该已清空');
    }

    /**
     * 测试获取员工的场景列表.
     */
    public function testGetAgentPlaybooks(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工作为测试数据
        $agentCode = $this->createTestAgent();

        // 创建多个 Playbook（包括已激活和未激活的）
        $playbook1Id = $this->createTestPlaybook($agentCode);

        // 创建第二个 Playbook（未激活）
        $playbook2Data = [
            'name_i18n' => [
                'zh_CN' => '未激活的 Playbook',
                'en_US' => 'Disabled Playbook',
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个未激活的 Playbook',
                'en_US' => 'This is a disabled playbook',
            ],
            'icon' => '📄',
            'theme_color' => '#10B981',
            'enabled' => false,
            'sort_order' => 0,
        ];
        $playbook2Response = $this->post(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            $playbook2Data,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $playbook2Response['code']);

        // 测试获取所有 Playbook（不传 enabled 参数）
        $response = $this->get(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            [],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertGreaterThanOrEqual(2, count($response['data']), '应该返回至少2个 Playbook');

        // 验证列表项结构
        if (count($response['data']) > 0) {
            $playbook = $response['data'][0];
            $this->assertArrayHasKey('id', $playbook);
            $this->assertArrayHasKey('agent_id', $playbook);
            $this->assertArrayHasKey('agent_code', $playbook);
            $this->assertArrayHasKey('name_i18n', $playbook);
            $this->assertArrayHasKey('description_i18n', $playbook);
            $this->assertArrayHasKey('icon', $playbook);
            $this->assertArrayHasKey('theme_color', $playbook);
            $this->assertArrayHasKey('enabled', $playbook);
            $this->assertArrayHasKey('sort_order', $playbook);
            $this->assertArrayHasKey('config', $playbook);
            $this->assertArrayHasKey('created_at', $playbook);
            $this->assertArrayHasKey('updated_at', $playbook);
        }

        // 验证排序：已激活的应该排在前面
        $foundDisabled = false;
        foreach ($response['data'] as $playbook) {
            if ($playbook['enabled']) {
                // 如果已经遇到未激活的，再遇到已激活的就是排序错误
                $this->assertFalse($foundDisabled, '已激活的 Playbook 应该排在未激活的前面');
            } else {
                $foundDisabled = true;
            }
        }

        // 测试仅获取已激活的 Playbook
        $enabledResponse = $this->get(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            ['enabled' => true],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $enabledResponse['code']);
        $this->assertIsArray($enabledResponse['data']);
        foreach ($enabledResponse['data'] as $playbook) {
            $this->assertTrue($playbook['enabled'], '应该只返回已激活的 Playbook');
        }

        // 测试仅获取未激活的 Playbook
        $disabledResponse = $this->get(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            ['enabled' => false],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $disabledResponse['code']);
        $this->assertIsArray($disabledResponse['data']);
        foreach ($disabledResponse['data'] as $playbook) {
            $this->assertFalse($playbook['enabled'], '应该只返回未激活的 Playbook');
        }

        // 测试获取不存在的员工的 Playbook
        $notFoundResponse = $this->get(
            self::BASE_URI . '/non_existent_agent_code_12345/playbooks',
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的员工应该返回错误');
    }

    public function testReorderPlaybooks(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工和多个 Playbook 作为测试数据
        $agentCode = $this->createTestAgent();
        $playbookId1 = $this->createTestPlaybook($agentCode);
        $playbookId2 = $this->createTestPlaybook($agentCode);
        $playbookId3 = $this->createTestPlaybook($agentCode);

        // 测试批量重排序：将顺序改为 [playbookId3, playbookId1, playbookId2]
        $reorderResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/reorder',
            ['ids' => [$playbookId3, $playbookId1, $playbookId2]],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $reorderResponse['code'], $reorderResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $reorderResponse);
        $this->assertIsArray($reorderResponse['data']);

        // 验证排序结果：获取 Playbook 列表，检查顺序
        $listResponse = $this->get(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $listResponse['code']);
        $listData = $listResponse['data'];
        $this->assertIsArray($listData);

        // 验证顺序：第一个应该是 playbookId3（sort_order 最大），第二个是 playbookId1，第三个是 playbookId2
        $this->assertGreaterThanOrEqual(3, count($listData), '应该有至少 3 个 Playbook');

        // 找到这三个 Playbook 并验证它们的顺序
        $foundIds = [];
        foreach ($listData as $playbook) {
            if (in_array($playbook['id'], [$playbookId1, $playbookId2, $playbookId3])) {
                $foundIds[] = $playbook['id'];
            }
        }

        $this->assertEquals([$playbookId3, $playbookId1, $playbookId2], $foundIds, 'Playbook 顺序应该正确');

        // 测试无效的 Playbook ID
        $invalidResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/reorder',
            ['ids' => [$playbookId1, 999999]],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $invalidResponse['code']);

        // 测试空的 ID 列表
        $emptyResponse = $this->put(
            self::BASE_URI . '/' . $agentCode . '/playbooks/reorder',
            ['ids' => []],
            $this->getCommonHeaders()
        );
        // 空列表可能返回验证错误或成功（取决于业务逻辑），这里只验证响应格式
        $this->assertArrayHasKey('code', $emptyResponse);
    }

    /**
     * 测试发布员工私有版本.
     */
    public function testPublishAgent(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工、绑定技能和 Playbook 作为测试数据
        $agentCode = $this->createTestAgent();
        $skillCode = $this->createTestSkillCode();
        $playbookId = $this->createTestPlaybook($agentCode);
        SuperMagicAgentModel::query()->where('code', $agentCode)->update(['file_key' => 'agents/publish-version.zip']);

        // 绑定技能到员工
        $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            ['skill_codes' => [$skillCode]],
            $this->getCommonHeaders()
        );

        $publishData = [
            'version' => '1.0.0',
            'version_description_i18n' => [
                'zh_CN' => '第一个私有版本',
                'en_US' => 'Initial private version',
            ],
            'publish_target_type' => 'PRIVATE',
        ];

        // 发布员工
        $response = $this->post(
            self::BASE_URI . '/' . $agentCode . '/publish',
            $publishData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertArrayHasKey('version_id', $response['data']);

        // 验证版本已创建：查询数据库获取版本ID
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $versionId = $response['data']['version_id'] ?? null;
        $this->assertNotNull($versionId, '应该创建了员工版本');

        // 验证版本状态为私有发布成功
        $version = $this->getAgentVersionById((int) $versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertEquals('PUBLISHED', $version['publish_status']);
        $this->assertEquals('APPROVED', $version['review_status']);
        $this->assertEquals('PRIVATE', $version['publish_target_type']);
        $this->assertTrue((bool) $version['is_current_version']);
        $this->assertEquals('1.0.0', $version['version']);
        $this->assertEquals($publishData['version_description_i18n']['zh_CN'], $version['version_description_i18n']['zh_CN']);
        $this->assertNotEmpty($version['published_at']);
        $this->assertEquals('agents/publish-version.zip', $version['file_key']);

        // 通过 agent_code 查询 agent_id
        $agent = SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $organizationCode)
            ->first();
        $this->assertNotNull($agent, '应该能找到员工记录');
        $agentId = $agent->id;

        // 验证 Skill 已复制到版本
        $versionSkills = AgentSkillModel::query()
            ->where('agent_id', $agentId)
            ->where('agent_version_id', $versionId)
            ->whereNull('deleted_at')
            ->get();
        $this->assertGreaterThan(0, $versionSkills->count(), '应该复制了 Skill 到版本');

        // 验证 Playbook 已复制到版本
        $versionPlaybooks = AgentPlaybookModel::query()
            ->where('agent_id', $agentId)
            ->where('agent_version_id', $versionId)
            ->whereNull('deleted_at')
            ->get();
        $this->assertGreaterThan(0, $versionPlaybooks->count(), '应该复制了 Playbook 到版本');

        // 测试再次发布，验证 current_version 切换
        $publishData2 = [
            'version' => '1.0.1',
            'version_description_i18n' => [
                'zh_CN' => '第二个私有版本',
                'en_US' => 'Second private version',
            ],
            'publish_target_type' => 'PRIVATE',
        ];
        $response2 = $this->post(
            self::BASE_URI . '/' . $agentCode . '/publish',
            $publishData2,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response2['code']);
        $versionId2 = $response2['data']['version_id'] ?? null;
        $this->assertNotNull($versionId2);
        $this->assertNotEquals($versionId, $versionId2, '应该创建了新版本');

        $version2 = $this->getAgentVersionById((int) $versionId2, $organizationCode);
        $this->assertNotNull($version2);
        $this->assertEquals('1.0.1', $version2['version']);
        $this->assertTrue((bool) $version2['is_current_version']);

        $version = $this->getAgentVersionById((int) $versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertFalse((bool) $version['is_current_version']);

        // 测试重复版本号
        $duplicateResponse = $this->post(
            self::BASE_URI . '/' . $agentCode . '/publish',
            $publishData2,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $duplicateResponse['code'], '重复版本号应该返回错误');

        // 测试发布不存在的员工
        $notFoundResponse = $this->post(
            self::BASE_URI . '/non_existent_agent_code_12345/publish',
            $publishData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的员工应该返回错误');
    }

    /**
     * 测试获取员工市场分类列表.
     */
    public function testGetCategories(): void
    {
        $this->switchUserTest1();

        $headers = $this->getCommonHeaders();
        $headers['user-id'] = $headers['user-id'] ?? 'usi_679b5905dcc171142572626192e4afce';
        $organizationCode = $headers['organization-code'];

        // 创建测试分类数据
        $category1 = AgentCategoryModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'organization_code' => $organizationCode,
            'name_i18n' => [
                'zh_CN' => '营销场景',
                'en_US' => 'Marketing Scenes',
            ],
            'logo' => 'categories/marketing-scenes.png',
            'sort_order' => 100,
            'creator_id' => $headers['user-id'],
        ]);

        $category2 = AgentCategoryModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'organization_code' => $organizationCode,
            'name_i18n' => [
                'zh_CN' => '数据分析',
                'en_US' => 'Data Analysis',
            ],
            'logo' => null,
            'sort_order' => 90,
            'creator_id' => $headers['user-id'],
        ]);

        $category3 = AgentCategoryModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'organization_code' => $organizationCode,
            'name_i18n' => [
                'zh_CN' => '内容创作',
                'en_US' => 'Content Creation',
            ],
            'logo' => null,
            'sort_order' => 0,
            'creator_id' => $headers['user-id'],
        ]);

        // 创建已发布的商店员工（关联到 category1）
        $agentCode1 = 'test_agent_' . IdGenerator::getSnowId();
        $agentCode2 = 'test_agent_' . IdGenerator::getSnowId();
        $agentVersionId = IdGenerator::getSnowId();

        AgentMarketModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'agent_code' => $agentCode1,
            'agent_version_id' => $agentVersionId,
            'category_id' => $category1->id,
            'publish_status' => PublishStatus::PUBLISHED->value,
            'publisher_id' => $headers['user-id'],
            'publisher_type' => 'USER',
            'organization_code' => $organizationCode,
        ]);

        AgentMarketModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'agent_code' => $agentCode2,
            'agent_version_id' => $agentVersionId,
            'category_id' => $category1->id,
            'publish_status' => PublishStatus::PUBLISHED->value,
            'publisher_id' => $headers['user-id'],
            'publisher_type' => 'USER',
            'organization_code' => $organizationCode,
        ]);

        // 调用接口
        $response = $this->get(
            '/api/v2/super-magic/agent-market/categories',
            [],
            $headers
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('list', $response['data']);
        $this->assertIsArray($response['data']['list']);

        $list = $response['data']['list'];
        $this->assertGreaterThanOrEqual(3, count($list), '应该至少有 3 个分类');

        // 验证排序：按 sort_order DESC 排序
        $foundCategory1 = null;
        $foundCategory2 = null;
        $foundCategory3 = null;

        foreach ($list as $item) {
            if ((int) $item['id'] === $category1->id) {
                $foundCategory1 = $item;
            } elseif ((int) $item['id'] === $category2->id) {
                $foundCategory2 = $item;
            } elseif ((int) $item['id'] === $category3->id) {
                $foundCategory3 = $item;
            }
        }

        $this->assertNotNull($foundCategory1, '应该找到 category1');
        $this->assertNotNull($foundCategory2, '应该找到 category2');
        $this->assertNotNull($foundCategory3, '应该找到 category3');

        // 验证 category1 的数据
        $this->assertEquals($category1->id, $foundCategory1['id']);
        $this->assertEquals($category1->name_i18n, $foundCategory1['name_i18n']);
        $this->assertEquals(100, $foundCategory1['sort_order']);
        $this->assertEquals(2, $foundCategory1['crew_count'], 'category1 应该有 2 个员工');

        // 验证 category2 的数据
        $this->assertEquals($category2->id, $foundCategory2['id']);
        $this->assertEquals($category2->name_i18n, $foundCategory2['name_i18n']);
        $this->assertEquals(90, $foundCategory2['sort_order']);
        $this->assertEquals(0, $foundCategory2['crew_count'], 'category2 应该有 0 个员工');

        // 验证 category3 的数据
        $this->assertEquals($category3->id, $foundCategory3['id']);
        $this->assertEquals($category3->name_i18n, $foundCategory3['name_i18n']);
        $this->assertEquals(0, $foundCategory3['sort_order']);
        $this->assertEquals(0, $foundCategory3['crew_count'], 'category3 应该有 0 个员工');

        // 验证排序顺序：sort_order 大的在前
        $category1Index = array_search($category1->id, array_column($list, 'id'));
        $category2Index = array_search($category2->id, array_column($list, 'id'));
        $category3Index = array_search($category3->id, array_column($list, 'id'));

        $this->assertLessThan($category2Index, $category1Index, 'category1 (sort_order=100) 应该在 category2 (sort_order=90) 之前');
        $this->assertLessThan($category3Index, $category2Index, 'category2 (sort_order=90) 应该在 category3 (sort_order=0) 之前');

        // 清理测试数据
        AgentMarketModel::query()
            ->whereIn('agent_code', [$agentCode1, $agentCode2])
            ->delete();

        AgentCategoryModel::query()
            ->whereIn('id', [$category1->id, $category2->id, $category3->id])
            ->delete();
    }

    public function testGetAgentVersionList(): void
    {
        $this->switchUserTest1();

        $agentCode = $this->createTestAgent();

        $publishData1 = [
            'version' => '1.0.0',
            'version_description_i18n' => [
                'zh_CN' => '第一个私有版本',
                'en_US' => 'Initial private version',
            ],
            'publish_target_type' => 'PRIVATE',
        ];
        $publishData2 = [
            'version' => '1.0.1',
            'version_description_i18n' => [
                'zh_CN' => '第二个私有版本',
                'en_US' => 'Second private version',
            ],
            'publish_target_type' => 'PRIVATE',
        ];

        $response1 = $this->post(self::BASE_URI . '/' . $agentCode . '/publish', $publishData1, $this->getCommonHeaders());
        $response2 = $this->post(self::BASE_URI . '/' . $agentCode . '/publish', $publishData2, $this->getCommonHeaders());
        $this->assertEquals(1000, $response1['code']);
        $this->assertEquals(1000, $response2['code']);

        $listResponse = $this->get(
            self::BASE_URI . '/' . $agentCode . '/versions',
            ['page' => 1, 'page_size' => 20],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $listResponse['code'], $listResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $listResponse);
        $this->assertArrayHasKey('list', $listResponse['data']);
        $this->assertGreaterThanOrEqual(2, count($listResponse['data']['list']));

        $first = $listResponse['data']['list'][0];
        $this->assertArrayHasKey('version', $first);
        $this->assertArrayNotHasKey('status', $first);
        $this->assertArrayHasKey('publish_status', $first);
        $this->assertArrayHasKey('publish_target_type', $first);
        $this->assertArrayHasKey('publish_to_label', $first);
        $this->assertArrayHasKey('publisher', $first);
        $this->assertArrayHasKey('is_current_version', $first);
        $this->assertArrayHasKey('version_description_i18n', $first);

        $this->assertEquals('1.0.1', $first['version']);
        $this->assertEquals('PUBLISHED', $first['publish_status']);
        $this->assertEquals('PRIVATE', $first['publish_target_type']);
        $this->assertEquals('Private', $first['publish_to_label']);
        $this->assertTrue($first['is_current_version']);
        $this->assertEquals('第二个私有版本', $first['version_description_i18n']['zh_CN']);
    }

    public function testTouchUpdatedAt(): void
    {
        $this->switchUserTest1();

        $agentCode = $this->createTestAgent();
        $headers = $this->getCommonHeaders();

        $originalUpdatedAt = '2026-03-01 10:00:00';
        SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $headers['organization-code'])
            ->update([
                'updated_at' => $originalUpdatedAt,
                'modifier' => 'legacy-user',
            ]);

        $response = $this->put(
            self::BASE_URI . '/' . $agentCode . '/updated-at',
            [],
            $headers
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertSame([], $response['data']);

        $agent = SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $headers['organization-code'])
            ->first();
        $this->assertNotNull($agent);
        $this->assertNotEquals($originalUpdatedAt, $agent->updated_at?->format('Y-m-d H:i:s'));
        $this->assertEquals($headers['user-id'], $agent->modifier);
    }

    public function testSandboxTouchUpdatedAt(): void
    {
        $this->switchUserTest1();

        $agentCode = $this->createTestAgent();
        $headers = $this->getCommonHeaders();

        $originalUpdatedAt = '2026-03-02 10:00:00';
        SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $headers['organization-code'])
            ->update([
                'updated_at' => $originalUpdatedAt,
                'modifier' => 'legacy-user',
            ]);

        $response = $this->put(
            '/api/v1/open-api/sandbox/agents/' . $agentCode . '/updated-at',
            [],
            $headers
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertSame([], $response['data']);

        $agent = SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $headers['organization-code'])
            ->first();
        $this->assertNotNull($agent);
        $this->assertNotEquals($originalUpdatedAt, $agent->updated_at?->format('Y-m-d H:i:s'));
        $this->assertEquals($headers['user-id'], $agent->modifier);
    }

    public function testSandboxGetLatestVersion(): void
    {
        $this->switchUserTest1();

        $agentCode = $this->createTestAgent();
        $skillCode = $this->createTestSkillCode();

        SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $this->getCommonHeaders()['organization-code'])
            ->update(['file_key' => 'agents/latest-version.zip']);

        $this->put(
            self::BASE_URI . '/' . $agentCode . '/skills',
            ['skill_codes' => [$skillCode]],
            $this->getCommonHeaders()
        );

        $publishData = [
            'version' => '2.0.0',
            'version_description_i18n' => [
                'zh_CN' => '沙箱最新版本',
                'en_US' => 'Sandbox latest version',
            ],
            'publish_target_type' => 'PRIVATE',
        ];

        $publishResponse = $this->post(
            self::BASE_URI . '/' . $agentCode . '/publish',
            $publishData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $publishResponse['code'], $publishResponse['message'] ?? '');

        SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $this->getCommonHeaders()['organization-code'])
            ->update(['file_key' => 'agents/current-draft.zip']);

        $response = $this->get(
            '/api/v1/open-api/sandbox/agents/' . $agentCode . '/latest-version',
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $data = $response['data'];
        $this->assertEquals($agentCode, $data['code']);
        $this->assertEquals('2.0.0', $data['version_code']);
        $this->assertNotNull($data['version_id']);
        $this->assertArrayHasKey('file_key', $data);
        $this->assertArrayHasKey('file_url', $data);
        $this->assertArrayHasKey('latest_published_at', $data);
        $this->assertEquals('agents/latest-version.zip', $data['file_key']);
        $this->assertNotNull($data['latest_published_at']);
        $this->assertIsArray($data['skills']);
        $this->assertCount(1, $data['skills']);
        $this->assertArrayHasKey('file_url', $data['skills'][0]);
    }

    /**
     * 测试审核员工版本.
     */
    public function testReviewAgentVersion(): void
    {
        $this->switchUserTest1();

        // 先创建一个员工
        $agentCode = $this->createTestAgent();

        SuperMagicAgentModel::query()->where('code', $agentCode)->update(['project_id' => 111]);

        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $agent = SuperMagicAgentModel::query()
            ->where('code', $agentCode)
            ->where('organization_code', $organizationCode)
            ->first();
        $this->assertNotNull($agent);

        $versionId = IdGenerator::getSnowId();
        AgentVersionModel::query()->create([
            'id' => $versionId,
            'code' => $agentCode,
            'organization_code' => $organizationCode,
            'version' => 'market-1.0.0',
            'name' => $agent->name,
            'description' => $agent->description,
            'icon' => $agent->icon,
            'icon_type' => $agent->icon_type,
            'type' => $agent->type,
            'enabled' => $agent->enabled,
            'prompt' => $agent->prompt,
            'tools' => $agent->tools,
            'creator' => $headers['user-id'],
            'modifier' => $headers['user-id'],
            'name_i18n' => $agent->name_i18n,
            'role_i18n' => $agent->role_i18n,
            'description_i18n' => $agent->description_i18n,
            'publish_status' => 'UNPUBLISHED',
            'review_status' => 'UNDER_REVIEW',
            'publish_target_type' => 'MARKET',
            'publisher_user_id' => $headers['user-id'],
            'project_id' => 111,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // 测试审核通过（创建商店记录）
        $approveData = [
            'action' => 'APPROVED',
            'publisher_type' => 'USER',
        ];
        $approveResponse = $this->put(
            '/api/v2/admin/super-magic/agents/versions/' . $versionId . '/review',
            $approveData,
            $headers
        );

        // 如果返回权限错误，跳过测试
        if (isset($approveResponse['code']) && in_array($approveResponse['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口需要管理员权限，跳过测试');
            return;
        }

        // 验证审核通过响应
        $this->assertEquals(1000, $approveResponse['code'], $approveResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $approveResponse);
        $this->assertIsArray($approveResponse['data']);
        $this->assertEmpty($approveResponse['data'], '审核成功应返回空数组');

        // 验证版本状态已更新为已发布
        $version = $this->getAgentVersionById((int) $versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertEquals('PUBLISHED', $version['publish_status']);
        $this->assertEquals('APPROVED', $version['review_status']);
        $this->assertEquals('MARKET', $version['publish_target_type']);
        $this->assertEquals('111', (string) $version['project_id']);
        $this->assertTrue((bool) $version['is_current_version']);
        $this->assertNotEmpty($version['published_at']);

        $agent->refresh();
        $this->assertEquals($version['published_at'], $agent->latest_published_at?->format('Y-m-d H:i:s'));

        $detailResponse = $this->get(
            self::BASE_URI . '/' . $agentCode,
            [],
            $headers
        );
        $this->assertEquals(1000, $detailResponse['code'], $detailResponse['message'] ?? '');
        $this->assertEquals($version['published_at'], $detailResponse['data']['latest_published_at']);

        $listResponse = $this->post(
            self::BASE_URI . '/queries',
            ['page' => 1, 'page_size' => 20],
            $headers
        );
        $this->assertEquals(1000, $listResponse['code'], $listResponse['message'] ?? '');
        $agentListItem = null;
        foreach ($listResponse['data']['list'] as $item) {
            if (($item['code'] ?? null) === $agentCode) {
                $agentListItem = $item;
                break;
            }
        }
        $this->assertNotNull($agentListItem);
        $this->assertEquals($version['published_at'], $agentListItem['latest_published_at']);

        // 验证商店记录已创建
        $storeAgent = AgentMarketModel::query()->where('agent_code', $agentCode)->first();
        $this->assertNotNull($storeAgent, '应该创建了商店记录');
        $this->assertEquals($versionId, $storeAgent->agent_version_id);
        $this->assertEquals('PUBLISHED', $storeAgent->publish_status);
        $this->assertEquals('USER', $storeAgent->publisher_type);

        $versionId2 = IdGenerator::getSnowId();
        AgentVersionModel::query()->create([
            'id' => $versionId2,
            'code' => $agentCode,
            'organization_code' => $organizationCode,
            'version' => 'market-1.0.1',
            'name' => $agent->name,
            'description' => $agent->description,
            'icon' => $agent->icon,
            'icon_type' => $agent->icon_type,
            'type' => $agent->type,
            'enabled' => $agent->enabled,
            'prompt' => $agent->prompt,
            'tools' => $agent->tools,
            'creator' => $headers['user-id'],
            'modifier' => $headers['user-id'],
            'name_i18n' => $agent->name_i18n,
            'role_i18n' => $agent->role_i18n,
            'description_i18n' => $agent->description_i18n,
            'publish_status' => 'UNPUBLISHED',
            'review_status' => 'UNDER_REVIEW',
            'publish_target_type' => 'MARKET',
            'publisher_user_id' => $headers['user-id'],
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // 测试审核通过（更新已存在的商店记录）
        $approveData2 = [
            'action' => 'APPROVED',
            'publisher_type' => 'OFFICIAL',
        ];
        $approveResponse2 = $this->put(
            '/api/v2/super-magic/admin/agents/versions/' . $versionId2 . '/review',
            $approveData2,
            $headers
        );
        $this->assertEquals(1000, $approveResponse2['code']);

        // 验证版本状态已更新
        $version2 = $this->getAgentVersionById((int) $versionId2, $organizationCode);
        $this->assertNotNull($version2);
        $this->assertEquals('PUBLISHED', $version2['publish_status']);
        $this->assertEquals('APPROVED', $version2['review_status']);
        $this->assertTrue((bool) $version2['is_current_version']);

        $version = $this->getAgentVersionById((int) $versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertFalse((bool) $version['is_current_version']);

        // 验证商店记录已更新（不是创建新记录）
        $storeAgentCount = AgentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->count();
        $this->assertEquals(1, $storeAgentCount, '应该只有一条商店记录');

        $storeAgent2 = AgentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->first();
        $this->assertNotNull($storeAgent2);
        $this->assertEquals($versionId2, $storeAgent2->agent_version_id, '商店记录应该更新到新版本');
        $this->assertEquals('OFFICIAL', $storeAgent2->publisher_type, '发布者类型应该更新为 OFFICIAL');

        $versionId3 = IdGenerator::getSnowId();
        AgentVersionModel::query()->create([
            'id' => $versionId3,
            'code' => $agentCode,
            'organization_code' => $organizationCode,
            'version' => 'market-1.0.2',
            'name' => $agent->name,
            'description' => $agent->description,
            'icon' => $agent->icon,
            'icon_type' => $agent->icon_type,
            'type' => $agent->type,
            'enabled' => $agent->enabled,
            'prompt' => $agent->prompt,
            'tools' => $agent->tools,
            'creator' => $headers['user-id'],
            'modifier' => $headers['user-id'],
            'name_i18n' => $agent->name_i18n,
            'role_i18n' => $agent->role_i18n,
            'description_i18n' => $agent->description_i18n,
            'publish_status' => 'UNPUBLISHED',
            'review_status' => 'UNDER_REVIEW',
            'publish_target_type' => 'MARKET',
            'publisher_user_id' => $headers['user-id'],
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // 测试审核拒绝
        $rejectData = [
            'action' => 'REJECTED',
        ];
        $rejectResponse = $this->put(
            '/api/v2/super-magic/admin/agents/versions/' . $versionId3 . '/review',
            $rejectData,
            $headers
        );
        $this->assertEquals(1000, $rejectResponse['code']);

        // 验证版本状态已更新为拒绝
        $version3 = $this->getAgentVersionById((int) $versionId3, $organizationCode);
        $this->assertNotNull($version3);
        $this->assertEquals('REJECTED', $version3['review_status']);
        $this->assertEquals('UNPUBLISHED', $version3['publish_status'], '拒绝后发布状态应保持为未发布');
        $this->assertFalse((bool) $version3['is_current_version']);

        $version2 = $this->getAgentVersionById((int) $versionId2, $organizationCode);
        $this->assertNotNull($version2);
        $this->assertTrue((bool) $version2['is_current_version'], '拒绝新版本后，上一条已发布版本仍应保持 current');

        // 验证商店记录没有被创建或更新（应该还是之前的记录）
        $storeAgent3 = AgentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->first();
        $this->assertNotNull($storeAgent3);
        $this->assertEquals($versionId2, $storeAgent3->agent_version_id, '商店记录应该还是之前的版本');

        // 测试无效的审核操作
        $invalidData = [
            'action' => 'INVALID_ACTION',
        ];
        $invalidResponse = $this->put(
            '/api/v2/super-magic/admin/agents/versions/' . $versionId3 . '/review',
            $invalidData,
            $headers
        );
        $this->assertNotEquals(1000, $invalidResponse['code'], '无效的审核操作应该返回错误');

        // 测试版本不存在的情况
        $notFoundResponse = $this->put(
            '/api/v2/super-magic/admin/agents/versions/999999999/review',
            $approveData,
            $headers
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的版本应该返回错误');

        // 测试版本状态不正确的情况（已发布的版本不能再次审核）
        $alreadyPublishedResponse = $this->put(
            '/api/v2/super-magic/admin/agents/versions/' . $versionId . '/review',
            $approveData,
            $headers
        );
        $this->assertNotEquals(1000, $alreadyPublishedResponse['code'], '已发布的版本不能再次审核');
    }

    /**
     * 创建测试员工并返回 agent_code.
     *
     * @return string agent_code
     */
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

        // 根据 agent_id 查询 agent_code
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $agent = SuperMagicAgentModel::query()
            ->where('code', $agentId)
            ->where('organization_code', $organizationCode)
            ->first();

        $this->assertNotNull($agent, '应该创建了员工记录');
        $agentCode = $agent->code;
        $this->assertNotNull($agentCode, 'agent_code 不应为空');

        return $agentCode;
    }

    /**
     * 创建测试 Playbook 并返回 playbook_id.
     *
     * @param string $agentCode Agent code
     * @return int playbook_id
     */
    private function createTestPlaybook(string $agentCode): int
    {
        $playbookData = [
            'name_i18n' => [
                'zh_CN' => '测试 Playbook',
                'en_US' => 'Test Playbook',
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个测试 Playbook',
                'en_US' => 'This is a test playbook',
            ],
            'icon' => '📊',
            'theme_color' => '#4F46E5',
            'enabled' => true,
            'sort_order' => 0,
        ];

        $response = $this->post(
            self::BASE_URI . '/' . $agentCode . '/playbooks',
            $playbookData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);

        return (int) $response['data']['id'];
    }

    /**
     * 创建测试技能并返回 skill_id.
     *
     * @return int skill_id
     */
    private function createTestSkill(): int
    {
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $userId = $headers['user-id'] ?? 'usi_1c9ce66fd7e756aaaa6f3412d50d8760';

        // 创建技能记录
        $skill = new SkillModel();
        $skill->id = IdGenerator::getSnowId();
        $skill->organization_code = $organizationCode;
        $skill->code = IdGenerator::getUniqueId32();
        $skill->creator_id = $userId;
        $skill->package_name = 'test_skill_' . IdGenerator::getUniqueId32();
        $skill->package_description = 'Test Skill Package';
        $skill->name_i18n = [
            'zh_CN' => '测试技能',
            'en_US' => 'Test Skill',
        ];
        $skill->description_i18n = [
            'zh_CN' => '这是一个测试技能',
            'en_US' => 'This is a test skill',
        ];
        $skill->file_key = 'test/file_key.zip';
        $skill->source_type = 'LOCAL_UPLOAD';
        $skill->is_enabled = true;
        $skill->save();

        // 创建技能版本记录
        $skillVersion = new SkillVersionModel();
        $skillVersion->id = IdGenerator::getSnowId();
        $skillVersion->code = $skill->code;
        $skillVersion->organization_code = $organizationCode;
        $skillVersion->creator_id = $userId;
        $skillVersion->package_name = $skill->package_name;
        $skillVersion->package_description = $skill->package_description;
        $skillVersion->version = '1.0.0';
        $skillVersion->name_i18n = $skill->name_i18n;
        $skillVersion->description_i18n = $skill->description_i18n;
        $skillVersion->file_key = $skill->file_key;
        $skillVersion->publish_status = 'PUBLISHED';
        $skillVersion->review_status = 'APPROVED';
        $skillVersion->source_type = 'LOCAL_UPLOAD';
        $skillVersion->save();

        // 更新技能的 version_id 和 version_code
        $skill->version_id = $skillVersion->id;
        $skill->version_code = $skillVersion->version;
        $skill->save();

        return $skill->id;
    }

    /**
     * 创建测试技能并返回技能 code.
     */
    private function createTestSkillCode(): string
    {
        $skillId = $this->createTestSkill();

        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];

        $skill = SkillModel::query()
            ->where('id', $skillId)
            ->where('organization_code', $organizationCode)
            ->first();

        $this->assertNotNull($skill, '应该创建了技能记录');
        $skillCode = $skill->code;
        $this->assertNotNull($skillCode, 'skill_code 不应为空');

        return $skillCode;
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

    private function shareAgentWithUser(string $agentCode, string $ownerUserId, string $targetUserId): void
    {
        ResourceVisibilityModel::query()->create([
            'id' => IdGenerator::getSnowId(),
            'organization_code' => env('TEST_ORGANIZATION_CODE'),
            'principal_type' => PrincipalType::USER->value,
            'principal_id' => $targetUserId,
            'resource_type' => ResourceType::SUPER_MAGIC_AGENT->value,
            'resource_code' => $agentCode,
            'creator' => $ownerUserId,
            'modifier' => $ownerUserId,
        ]);
    }

    /**
     * 根据版本ID获取 Agent 版本信息.
     */
    private function getAgentVersionById(int $versionId, string $organizationCode): ?array
    {
        $version = AgentVersionModel::query()
            ->where('id', $versionId)
            ->where('organization_code', $organizationCode)
            ->first();

        if (! $version) {
            return null;
        }

        return $version->toArray();
    }
}
