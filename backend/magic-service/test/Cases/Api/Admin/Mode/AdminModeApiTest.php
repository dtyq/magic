<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\Mode;

use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;

/**
 * @internal
 * 模式配置管理API测试
 */
class AdminModeApiTest extends AbstractApiTest
{
    private const BASE_URI = '/api/v1/official/admin/modes';

    private string $modeId = '849246419151671297';

    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
    }

    /**
     * 测试更新模式配置并添加动态模型.
     */
    public function testSaveModeConfigWithDynamicModelCreation(): void
    {
        $this->switchUserTest1();

        // 准备请求数据，包含动态模型
        $requestData = [
            'mode' => [
                'id' => $this->modeId,
                'name_i18n' => [
                    'en_US' => '测试',
                    'zh_CN' => '测试ssm',
                ],
                'placeholder_i18n' => [
                    'en_US' => '',
                    'zh_CN' => '测试ssm',
                ],
                'identifier' => '测试ssm2',
                'icon' => '',
                'color' => '#be5f00',
                'icon_type' => 2,
                'icon_url' => '/TGosRaFhvb/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/ihfWlzfFD6m5TI_esYJ-0.png',
                'description' => '',
                'distribution_type' => 1,
                'follow_mode_id' => '0',
                'is_default' => 0,
                'status' => true,
                'sort' => 0,
                'created_at' => '2025-11-18 11:22:04',
                'organization_whitelist' => '',
            ],
            'groups' => [
                [
                    'group' => [
                        'id' => '870254238134796289',
                        'mode_id' => $this->modeId,
                        'name_i18n' => [
                            'en_US' => 'doubao',
                            'zh_CN' => '超级豆包',
                        ],
                        'icon' => '/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/default-files/68b16b1d298e6.png',
                        'description' => '',
                        'sort' => 0,
                        'status' => true,
                        'created_at' => '2026-01-15 10:39:38',
                    ],
                    'models' => [
                        [
                            'id' => 'temp-1768491835729',
                            'provider_model_id' => '836641895902928897',
                            'group_id' => '870254238134796289',
                            'model_id' => 'max',
                            'model_name' => 'MAX',
                            'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTZDk2MjgwM2FjYTMxNGFkNDkwNWNlZDhiYmQ1ZDUzNzg%2F20260115%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260115T154340Z&X-Tos-Expires=86400&X-Tos-SignedHeaders=host&X-Tos-Signature=ba915215174b3e4f013c8d050187507a8a6538ab1bfc9783bad32c7f221fe41c',
                            'sort' => 0,
                            'model_status' => 'normal',
                        ],
                        // 动态模型
                        [
                            'id' => 'temp-' . time(),
                            'provider_model_id' => '0', // 0 表示新增动态模型
                            'group_id' => '870254238134796289',
                            'model_id' => '', // 新增时为空
                            'model_name' => '智能GPT',
                            'model_icon' => '/MAGIC/588417216353927169/default/doubaoAvatarsWhite.png',
                            'model_description' => '智能GPT动态模型',
                            'model_type' => 'dynamic', // 动态模型标识
                            'model_category' => 'llm',
                            'aggregate_config' => [
                                'models' => [ // 子模型列表（对象数组格式）
                                    [
                                        'id' => 'temp-max-' . time(),
                                        'provider_model_id' => '836641895902928897',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'max',
                                        'model_name' => 'MAX',
                                        'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png',
                                        'sort' => 0,
                                        'model_status' => 'normal',
                                    ],
                                    [
                                        'id' => 'temp-doubao-' . time(),
                                        'provider_model_id' => '0',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'doubao-seed-1.8',
                                        'model_name' => 'Doubao Seed 1.8',
                                        'model_icon' => '',
                                        'sort' => 1,
                                        'model_status' => 'normal',
                                    ],
                                ],
                                'strategy' => 'permission_fallback', // 策略类型
                                'strategy_config' => [
                                    'order' => 'asc', // 顺序方向
                                ],
                            ],
                            'model_translate' => [
                                'name' => [
                                    'en_US' => 'Smart GPT',
                                    'zh_CN' => '智能GPT',
                                ],
                                'description' => [
                                    'en_US' => 'Smart GPT Dynamic Model',
                                    'zh_CN' => '智能GPT动态模型',
                                ],
                            ],
                            'sort' => 1,
                        ],
                    ],
                ],
                [
                    'group' => [
                        'id' => '870254658043346944',
                        'mode_id' => $this->modeId,
                        'name_i18n' => [
                            'en_US' => 'Deepseek',
                            'zh_CN' => 'DeepSeek',
                        ],
                        'icon' => '/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/default-files/68b16b1ae7794.png',
                        'description' => '',
                        'sort' => 0,
                        'status' => true,
                        'created_at' => '2026-01-15 10:41:19',
                    ],
                    'models' => [],
                ],
            ],
        ];

        // 发送PUT请求
        $response = $this->put(self::BASE_URI . "/{$this->modeId}/config", $requestData, $this->getCommonHeaders());

        // 验证响应
        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('ok', $response['message']);
        $this->assertIsArray($response['data']);

        // 验证返回的模式数据
        $this->assertArrayHasKey('mode', $response['data']);
        $this->assertArrayHasKey('groups', $response['data']);

        $mode = $response['data']['mode'];
        $this->assertEquals($this->modeId, $mode['id']);

        // 验证分组数据
        $groups = $response['data']['groups'];
        $this->assertIsArray($groups);
        $this->assertGreaterThan(0, count($groups));

        // 验证第一个分组包含模型（包括动态模型）
        $firstGroup = $groups[0];
        $this->assertArrayHasKey('group', $firstGroup);
        $this->assertArrayHasKey('models', $firstGroup);

        $models = $firstGroup['models'];
        $this->assertIsArray($models);
        $this->assertGreaterThan(0, count($models));

        // 查找动态模型
        $dynamicModelFound = false;
        foreach ($models as $model) {
            if (isset($model['model_type']) && $model['model_type'] === 'dynamic') {
                $dynamicModelFound = true;
                // 验证动态模型的关键字段
                $this->assertArrayHasKey('model_category', $model);
                $this->assertEquals('llm', $model['model_category']);
                $this->assertArrayHasKey('aggregate_config', $model);
                $this->assertArrayHasKey('model_id', $model);
                $this->assertNotEmpty($model['model_id'], '动态模型的model_id不应该为空');

                $aggregateConfig = $model['aggregate_config'];
                $this->assertIsArray($aggregateConfig);
                $this->assertArrayHasKey('models', $aggregateConfig);
                $this->assertIsArray($aggregateConfig['models']);
                $this->assertGreaterThan(0, count($aggregateConfig['models']));
                break;
            }
        }

        $this->assertTrue($dynamicModelFound, '应该找到动态模型');

        // --------------------------------------------------------------------------------
        // 新增验证：调用详情接口验证数据是否正确落库
        // --------------------------------------------------------------------------------
        $detailResponse = $this->get(self::BASE_URI . "/{$this->modeId}", [], $this->getCommonHeaders());

        // 验证详情响应
        $this->assertNotNull($detailResponse, '详情响应不应该为null');
        $this->assertEquals(1000, $detailResponse['code'], $detailResponse['message'] ?? '');
        $this->assertEquals('ok', $detailResponse['message']);
        $this->assertIsArray($detailResponse['data']);

        // 验证详情数据结构
        $this->assertArrayHasKey('mode', $detailResponse['data']);
        $this->assertArrayHasKey('groups', $detailResponse['data']);

        // 验证详情中的动态模型
        $detailGroups = $detailResponse['data']['groups'];
        $this->assertIsArray($detailGroups);
        $this->assertGreaterThan(0, count($detailGroups));

        $detailFirstGroup = $detailGroups[0];
        $detailModels = $detailFirstGroup['models'];
        $this->assertIsArray($detailModels);

        $detailDynamicModelFound = false;
        foreach ($detailModels as $model) {
            if (isset($model['model_type']) && $model['model_type'] === 'dynamic') {
                $detailDynamicModelFound = true;

                // 验证动态模型字段
                $this->assertArrayHasKey('model_category', $model);
                $this->assertEquals('llm', $model['model_category']);
                $this->assertArrayHasKey('aggregate_config', $model);
                $this->assertNotNull($model['aggregate_config'], '详情中动态模型的配置不应为空');
                $this->assertArrayHasKey('models', $model['aggregate_config']);
                $models = $model['aggregate_config']['models'];
                $this->assertIsArray($models);
                $this->assertGreaterThan(0, count($models));
                // 验证对象数组格式
                foreach ($models as $subModel) {
                    $this->assertIsArray($subModel);
                    $this->assertArrayHasKey('model_id', $subModel);
                }
                // 验证包含预期的子模型
                $modelIds = array_column($models, 'model_id');
                $this->assertContains('max', $modelIds);
                $this->assertContains('doubao-seed-1.8', $modelIds);

                // 验证其他字段
                $this->assertEquals('智能GPT', $model['model_name']);
                break;
            }
        }

        $this->assertTrue($detailDynamicModelFound, '详情接口中应该包含动态模型');
    }

    /**
     * 测试列表接口能正确显示动态模型.
     */
    public function testGetModesListWithDynamicModel(): void
    {
        $this->switchUserTest1();

        // 1. 先确保模式配置中包含动态模型（复用已有的创建逻辑）
        $requestData = [
            'mode' => [
                'id' => $this->modeId,
                'name_i18n' => [
                    'en_US' => '测试',
                    'zh_CN' => '测试ssm',
                ],
                'placeholder_i18n' => [
                    'en_US' => '',
                    'zh_CN' => '测试ssm',
                ],
                'identifier' => '测试ssm2',
                'icon' => '',
                'color' => '#be5f00',
                'icon_type' => 2,
                'icon_url' => '/TGosRaFhvb/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/ihfWlzfFD6m5TI_esYJ-0.png',
                'description' => '',
                'distribution_type' => 1,
                'follow_mode_id' => '0',
                'is_default' => 0,
                'status' => true,
                'sort' => 0,
                'created_at' => '2025-11-18 11:22:04',
                'organization_whitelist' => '',
            ],
            'groups' => [
                [
                    'group' => [
                        'id' => '870254238134796289',
                        'mode_id' => $this->modeId,
                        'name_i18n' => [
                            'en_US' => 'doubao',
                            'zh_CN' => '超级豆包',
                        ],
                        'icon' => '/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/default-files/68b16b1d298e6.png',
                        'description' => '',
                        'sort' => 0,
                        'status' => true,
                        'created_at' => '2026-01-15 10:39:38',
                    ],
                    'models' => [
                        [
                            'id' => 'temp-1768491835729',
                            'provider_model_id' => '836641895902928897',
                            'group_id' => '870254238134796289',
                            'model_id' => 'max',
                            'model_name' => 'MAX',
                            'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTZDk2MjgwM2FjYTMxNGFkNDkwNWNlZDhiYmQ1ZDUzNzg%2F20260115%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260115T154340Z&X-Tos-Expires=86400&X-Tos-SignedHeaders=host&X-Tos-Signature=ba915215174b3e4f013c8d050187507a8a6538ab1bfc9783bad32c7f221fe41c',
                            'sort' => 0,
                            'model_status' => 'normal',
                        ],
                        // 动态模型
                        [
                            'id' => 'temp-' . time(),
                            'provider_model_id' => '0',
                            'group_id' => '870254238134796289',
                            'model_id' => '',
                            'model_name' => '智能GPT列表测试',
                            'model_icon' => '/MAGIC/588417216353927169/default/doubaoAvatarsWhite.png',
                            'model_description' => '智能GPT动态模型列表测试',
                            'model_type' => 'dynamic',
                            'model_category' => 'llm',
                            'aggregate_config' => [
                                'models' => [
                                    [
                                        'id' => 'temp-max-' . time(),
                                        'provider_model_id' => '836641895902928897',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'max',
                                        'model_name' => 'MAX',
                                        'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png',
                                        'sort' => 0,
                                        'model_status' => 'normal',
                                    ],
                                    [
                                        'id' => 'temp-doubao-' . time(),
                                        'provider_model_id' => '0',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'doubao-seed-1.8',
                                        'model_name' => 'Doubao Seed 1.8',
                                        'model_icon' => '',
                                        'sort' => 1,
                                        'model_status' => 'normal',
                                    ],
                                ],
                                'strategy' => 'permission_fallback',
                                'strategy_config' => [
                                    'order' => 'asc',
                                ],
                            ],
                            'model_translate' => [
                                'name' => [
                                    'en_US' => 'Smart GPT List Test',
                                    'zh_CN' => '智能GPT列表测试',
                                ],
                                'description' => [
                                    'en_US' => 'Smart GPT Dynamic Model List Test',
                                    'zh_CN' => '智能GPT动态模型列表测试',
                                ],
                            ],
                            'sort' => 1,
                        ],
                    ],
                ],
            ],
        ];

        // 保存模式配置
        $saveResponse = $this->put(self::BASE_URI . "/{$this->modeId}/config", $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $saveResponse['code'], '保存模式配置应该成功');

        // 2. 调用列表接口
        $listResponse = $this->get(self::BASE_URI, [], $this->getCommonHeaders());

        // 验证响应
        $this->assertNotNull($listResponse, '列表响应不应该为null');
        $this->assertEquals(1000, $listResponse['code'], $listResponse['message'] ?? '');
        $this->assertEquals('ok', $listResponse['message']);
        $this->assertIsArray($listResponse['data']);

        // 验证列表数据结构
        $this->assertArrayHasKey('total', $listResponse['data']);
        $this->assertArrayHasKey('list', $listResponse['data']);
        $this->assertIsArray($listResponse['data']['list']);
        $this->assertGreaterThan(0, $listResponse['data']['total'], '列表应该包含至少一个模式');

        // 3. 验证列表中的模式数据结构（列表接口只返回模式基本信息，不包含分组和模型信息）
        if (! empty($listResponse['data']['list'])) {
            $firstMode = $listResponse['data']['list'][0];
            $this->assertArrayHasKey('id', $firstMode);
            $this->assertArrayHasKey('name_i18n', $firstMode);
            $this->assertArrayNotHasKey('groups', $firstMode, '列表接口不应该包含groups字段');
        }
    }

    /**
     * 测试前台接口 /api/v1/modes 能正确返回动态模型.
     */
    public function testGetModesApiWithDynamicModel(): void
    {
        $this->switchUserTest1();

        // 1. 先确保模式配置中包含动态模型
        $requestData = [
            'mode' => [
                'id' => $this->modeId,
                'name_i18n' => [
                    'en_US' => '测试',
                    'zh_CN' => '测试ssm',
                ],
                'placeholder_i18n' => [
                    'en_US' => '',
                    'zh_CN' => '测试ssm',
                ],
                'identifier' => '测试ssm2',
                'icon' => '',
                'color' => '#be5f00',
                'icon_type' => 2,
                'icon_url' => '/TGosRaFhvb/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/ihfWlzfFD6m5TI_esYJ-0.png',
                'description' => '',
                'distribution_type' => 1,
                'follow_mode_id' => '0',
                'is_default' => 0,
                'status' => true,
                'sort' => 0,
                'created_at' => '2025-11-18 11:22:04',
                'organization_whitelist' => '',
            ],
            'groups' => [
                [
                    'group' => [
                        'id' => '870254238134796289',
                        'mode_id' => $this->modeId,
                        'name_i18n' => [
                            'en_US' => 'doubao',
                            'zh_CN' => '超级豆包',
                        ],
                        'icon' => '/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/default-files/68b16b1d298e6.png',
                        'description' => '',
                        'sort' => 0,
                        'status' => true,
                        'created_at' => '2026-01-15 10:39:38',
                    ],
                    'models' => [
                        [
                            'id' => 'temp-1768491835729',
                            'provider_model_id' => '836641895902928897',
                            'group_id' => '870254238134796289',
                            'model_id' => 'max',
                            'model_name' => 'MAX',
                            'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTZDk2MjgwM2FjYTMxNGFkNDkwNWNlZDhiYmQ1ZDUzNzg%2F20260115%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260115T154340Z&X-Tos-Expires=86400&X-Tos-SignedHeaders=host&X-Tos-Signature=ba915215174b3e4f013c8d050187507a8a6538ab1bfc9783bad32c7f221fe41c',
                            'sort' => 0,
                            'model_status' => 'normal',
                        ],
                        // 动态模型
                        [
                            'id' => 'temp-' . time(),
                            'provider_model_id' => '0',
                            'group_id' => '870254238134796289',
                            'model_id' => '',
                            'model_name' => '智能GPT前台测试',
                            'model_icon' => '/MAGIC/588417216353927169/default/doubaoAvatarsWhite.png',
                            'model_description' => '智能GPT动态模型前台测试',
                            'model_type' => 'dynamic',
                            'model_category' => 'llm',
                            'aggregate_config' => [
                                'models' => [
                                    [
                                        'id' => 'temp-max-' . time(),
                                        'provider_model_id' => '836641895902928897',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'max',
                                        'model_name' => 'MAX',
                                        'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png',
                                        'sort' => 0,
                                        'model_status' => 'normal',
                                    ],
                                    [
                                        'id' => 'temp-doubao-' . time(),
                                        'provider_model_id' => '0',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'doubao-seed-1.8',
                                        'model_name' => 'Doubao Seed 1.8',
                                        'model_icon' => '',
                                        'sort' => 1,
                                        'model_status' => 'normal',
                                    ],
                                ],
                                'strategy' => 'permission_fallback',
                                'strategy_config' => [
                                    'order' => 'asc',
                                ],
                            ],
                            'model_translate' => [
                                'name' => [
                                    'en_US' => 'Smart GPT Frontend Test',
                                    'zh_CN' => '智能GPT前台测试',
                                ],
                                'description' => [
                                    'en_US' => 'Smart GPT Dynamic Model Frontend Test',
                                    'zh_CN' => '智能GPT动态模型前台测试',
                                ],
                            ],
                            'sort' => 1,
                        ],
                    ],
                ],
            ],
        ];

        // 保存模式配置
        $saveResponse = $this->put(self::BASE_URI . "/{$this->modeId}/config", $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $saveResponse['code'], '保存模式配置应该成功');

        // 2. 调用前台接口 /api/v1/modes
        $modesResponse = $this->get('/api/v1/modes', [], $this->getCommonHeaders());

        // 验证响应
        $this->assertNotNull($modesResponse, '响应不应该为null');
        $this->assertEquals(1000, $modesResponse['code'], $modesResponse['message'] ?? '');
        $this->assertEquals('ok', $modesResponse['message']);
        $this->assertIsArray($modesResponse['data']);

        // 验证数据结构
        $this->assertArrayHasKey('total', $modesResponse['data']);
        $this->assertArrayHasKey('list', $modesResponse['data']);
        $this->assertIsArray($modesResponse['data']['list']);
        $this->assertGreaterThan(0, $modesResponse['data']['total'], '列表应该包含至少一个模式');

        // 3. 查找包含动态模型的模式
        // 注意：/api/v1/modes 接口返回的数据结构是基于 Agent 的，需要遍历所有 Agent 的 groups
        $dynamicModelFound = false;
        foreach ($modesResponse['data']['list'] as $item) {
            // 验证数据结构
            $this->assertArrayHasKey('mode', $item);
            $this->assertArrayHasKey('agent', $item);
            $this->assertArrayHasKey('groups', $item);

            if (! isset($item['groups']) || ! is_array($item['groups'])) {
                continue;
            }

            foreach ($item['groups'] as $group) {
                // 验证分组数据结构
                $this->assertIsArray($group);

                // groups 数组中每个元素应该包含 'group' 和 'models' 字段
                // 注意：ModeGroupAggregateDTO 转换为数组后的结构是 ['group' => [...], 'models' => [...]]
                if (isset($group['group'], $group['models']) && is_array($group['models'])) {
                    foreach ($group['models'] as $model) {
                        // 通过 model_name 来识别动态模型（前台接口只返回基础字段）
                        if (isset($model['model_name']) && strpos($model['model_name'], '智能GPT') !== false) {
                            $dynamicModelFound = true;

                            // 验证动态模型返回的基础字段（与普通模型相同）
                            $this->assertArrayHasKey('id', $model);
                            $this->assertArrayHasKey('group_id', $model);
                            $this->assertArrayHasKey('model_id', $model);
                            $this->assertNotEmpty($model['model_id'], '动态模型的model_id不应该为空');
                            $this->assertArrayHasKey('model_name', $model);
                            $this->assertArrayHasKey('provider_model_id', $model);
                            $this->assertArrayHasKey('model_description', $model);
                            $this->assertArrayHasKey('model_icon', $model);
                            $this->assertArrayHasKey('sort', $model);
                            $this->assertArrayHasKey('model_status', $model);
                            $this->assertArrayHasKey('tags', $model);

                            // 验证前台接口不返回动态模型特有的字段
                            $this->assertArrayNotHasKey('aggregate_config', $model, '前台接口 /api/v1/modes 不应该返回 aggregate_config 字段');
                            $this->assertArrayNotHasKey('model_type', $model, '前台接口 /api/v1/modes 不应该返回 model_type 字段');
                            $this->assertArrayNotHasKey('model_category', $model, '前台接口 /api/v1/modes 不应该返回 model_category 字段');
                            $this->assertArrayNotHasKey('model_translate', $model, '前台接口 /api/v1/modes 不应该返回 model_translate 字段');

                            break 3;
                        }
                    }
                }
            }
        }

        $this->assertTrue($dynamicModelFound, '前台接口 /api/v1/modes 应该返回动态模型信息。如果失败，请检查：1. 动态模型是否已创建；2. 动态模型是否在启用的模式中；3. 动态模型是否通过了组织过滤器');
    }

    /**
     * 测试更新动态模型配置.
     */
    public function testUpdateDynamicModelConfig(): void
    {
        $this->switchUserTest1();

        // 1. 先创建一个动态模型
        $createRequestData = [
            'mode' => [
                'id' => $this->modeId,
                'name_i18n' => [
                    'en_US' => '测试',
                    'zh_CN' => '测试ssm',
                ],
                'placeholder_i18n' => [
                    'en_US' => '',
                    'zh_CN' => '测试ssm',
                ],
                'identifier' => '测试ssm2',
                'icon' => '',
                'color' => '#be5f00',
                'icon_type' => 2,
                'icon_url' => '/TGosRaFhvb/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/ihfWlzfFD6m5TI_esYJ-0.png',
                'description' => '',
                'distribution_type' => 1,
                'follow_mode_id' => '0',
                'is_default' => 0,
                'status' => true,
                'sort' => 0,
                'created_at' => '2025-11-18 11:22:04',
                'organization_whitelist' => '',
            ],
            'groups' => [
                [
                    'group' => [
                        'id' => '870254238134796289',
                        'mode_id' => $this->modeId,
                        'name_i18n' => [
                            'en_US' => 'doubao',
                            'zh_CN' => '超级豆包',
                        ],
                        'icon' => '/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/default-files/68b16b1d298e6.png',
                        'description' => '',
                        'sort' => 0,
                        'status' => true,
                        'created_at' => '2026-01-15 10:39:38',
                    ],
                    'models' => [
                        [
                            'id' => 'temp-1768491835729',
                            'provider_model_id' => '836641895902928897',
                            'group_id' => '870254238134796289',
                            'model_id' => 'max',
                            'model_name' => 'MAX',
                            'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTZDk2MjgwM2FjYTMxNGFkNDkwNWNlZDhiYmQ1ZDUzNzg%2F20260115%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260115T154340Z&X-Tos-Expires=86400&X-Tos-SignedHeaders=host&X-Tos-Signature=ba915215174b3e4f013c8d050187507a8a6538ab1bfc9783bad32c7f221fe41c',
                            'sort' => 0,
                            'model_status' => 'normal',
                        ],
                        // 创建动态模型
                        [
                            'id' => 'temp-' . time(),
                            'provider_model_id' => '0', // 0 表示新增动态模型
                            'group_id' => '870254238134796289',
                            'model_id' => '', // 新增时为空
                            'model_name' => '智能GPT更新测试',
                            'model_icon' => '/MAGIC/588417216353927169/default/doubaoAvatarsWhite.png',
                            'model_description' => '智能GPT动态模型更新测试',
                            'model_type' => 'dynamic',
                            'model_category' => 'llm',
                            'aggregate_config' => [
                                'models' => [ // 初始子模型列表（对象数组格式）
                                    [
                                        'id' => 'temp-max-' . time(),
                                        'provider_model_id' => '836641895902928897',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'max',
                                        'model_name' => 'MAX',
                                        'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png',
                                        'sort' => 0,
                                        'model_status' => 'normal',
                                    ],
                                    [
                                        'id' => 'temp-doubao-' . time(),
                                        'provider_model_id' => '0',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'doubao-seed-1.8',
                                        'model_name' => 'Doubao Seed 1.8',
                                        'model_icon' => '',
                                        'sort' => 1,
                                        'model_status' => 'normal',
                                    ],
                                ],
                                'strategy' => 'permission_fallback',
                                'strategy_config' => [
                                    'order' => 'asc',
                                ],
                            ],
                            'model_translate' => [
                                'name' => [
                                    'en_US' => 'Smart GPT Update Test',
                                    'zh_CN' => '智能GPT更新测试',
                                ],
                                'description' => [
                                    'en_US' => 'Smart GPT Dynamic Model Update Test',
                                    'zh_CN' => '智能GPT动态模型更新测试',
                                ],
                            ],
                            'sort' => 1,
                        ],
                    ],
                ],
            ],
        ];

        // 创建动态模型
        $createResponse = $this->put(self::BASE_URI . "/{$this->modeId}/config", $createRequestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $createResponse['code'], '创建动态模型应该成功');

        // 获取创建后的动态模型信息
        $detailResponse = $this->get(self::BASE_URI . "/{$this->modeId}", [], $this->getCommonHeaders());
        $this->assertEquals(1000, $detailResponse['code'], '获取详情应该成功');

        $createdDynamicModelId = null;
        $createdProviderModelId = null;
        foreach ($detailResponse['data']['groups'] as $group) {
            foreach ($group['models'] as $model) {
                if (isset($model['model_type']) && $model['model_type'] === 'dynamic' && $model['model_name'] === '智能GPT更新测试') {
                    $createdDynamicModelId = $model['model_id'];
                    $createdProviderModelId = $model['provider_model_id'];
                    break 2;
                }
            }
        }

        $this->assertNotNull($createdDynamicModelId, '应该找到创建的动态模型');
        $this->assertNotNull($createdProviderModelId, '应该找到创建的动态模型的provider_model_id');
        $this->assertNotEquals('0', $createdProviderModelId, 'provider_model_id不应该为0');

        // 2. 更新动态模型配置
        $updateRequestData = [
            'mode' => [
                'id' => $this->modeId,
                'name_i18n' => [
                    'en_US' => '测试',
                    'zh_CN' => '测试ssm',
                ],
                'placeholder_i18n' => [
                    'en_US' => '',
                    'zh_CN' => '测试ssm',
                ],
                'identifier' => '测试ssm2',
                'icon' => '',
                'color' => '#be5f00',
                'icon_type' => 2,
                'icon_url' => '/TGosRaFhvb/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/ihfWlzfFD6m5TI_esYJ-0.png',
                'description' => '',
                'distribution_type' => 1,
                'follow_mode_id' => '0',
                'is_default' => 0,
                'status' => true,
                'sort' => 0,
                'created_at' => '2025-11-18 11:22:04',
                'organization_whitelist' => '',
            ],
            'groups' => [
                [
                    'group' => [
                        'id' => '870254238134796289',
                        'mode_id' => $this->modeId,
                        'name_i18n' => [
                            'en_US' => 'doubao',
                            'zh_CN' => '超级豆包',
                        ],
                        'icon' => '/MAGIC/588417216353927169/4c9184f37cff01bcdc32dc486ec36961/default-files/68b16b1d298e6.png',
                        'description' => '',
                        'sort' => 0,
                        'status' => true,
                        'created_at' => '2026-01-15 10:39:38',
                    ],
                    'models' => [
                        [
                            'id' => 'temp-1768491835729',
                            'provider_model_id' => '836641895902928897',
                            'group_id' => '870254238134796289',
                            'model_id' => 'max',
                            'model_name' => 'MAX',
                            'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTZDk2MjgwM2FjYTMxNGFkNDkwNWNlZDhiYmQ1ZDUzNzg%2F20260115%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260115T154340Z&X-Tos-Expires=86400&X-Tos-SignedHeaders=host&X-Tos-Signature=ba915215174b3e4f013c8d050187507a8a6538ab1bfc9783bad32c7f221fe41c',
                            'sort' => 0,
                            'model_status' => 'normal',
                        ],
                        // 更新动态模型（使用已存在的 provider_model_id 和 model_id）
                        [
                            'id' => 'temp-' . time(),
                            'provider_model_id' => $createdProviderModelId, // 使用已存在的 provider_model_id
                            'group_id' => '870254238134796289',
                            'model_id' => $createdDynamicModelId, // 使用已存在的 model_id
                            'model_name' => '智能GPT更新后',
                            'model_icon' => '/MAGIC/588417216353927169/default/doubaoAvatarsWhite.png',
                            'model_description' => '智能GPT动态模型更新后',
                            'model_type' => 'dynamic',
                            'model_category' => 'llm',
                            'aggregate_config' => [
                                'models' => [ // 更新后的子模型列表（增加了gpt-4o，对象数组格式）
                                    [
                                        'id' => 'temp-max-' . time(),
                                        'provider_model_id' => '836641895902928897',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'max',
                                        'model_name' => 'MAX',
                                        'model_icon' => '/TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/iZ0rbT3qj68-P-xsgY9NY.png',
                                        'sort' => 0,
                                        'model_status' => 'normal',
                                    ],
                                    [
                                        'id' => 'temp-doubao-' . time(),
                                        'provider_model_id' => '0',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'doubao-seed-1.8',
                                        'model_name' => 'Doubao Seed 1.8',
                                        'model_icon' => '',
                                        'sort' => 1,
                                        'model_status' => 'normal',
                                    ],
                                    [
                                        'id' => 'temp-gpt4o-' . time(),
                                        'provider_model_id' => '0',
                                        'group_id' => '870254238134796289',
                                        'model_id' => 'gpt-4o',
                                        'model_name' => 'GPT-4o',
                                        'model_icon' => '',
                                        'sort' => 2,
                                        'model_status' => 'normal',
                                    ],
                                ],
                                'strategy' => 'permission_fallback',
                                'strategy_config' => [
                                    'order' => 'desc', // 更新顺序方向
                                ],
                            ],
                            'model_translate' => [
                                'name' => [
                                    'en_US' => 'Smart GPT Updated',
                                    'zh_CN' => '智能GPT更新后',
                                ],
                                'description' => [
                                    'en_US' => 'Smart GPT Dynamic Model Updated',
                                    'zh_CN' => '智能GPT动态模型更新后',
                                ],
                            ],
                            'sort' => 1,
                        ],
                    ],
                ],
            ],
        ];

        // 更新动态模型
        $updateResponse = $this->put(self::BASE_URI . "/{$this->modeId}/config", $updateRequestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $updateResponse['code'], '更新动态模型应该成功');

        // 3. 验证更新后的数据
        $updatedDetailResponse = $this->get(self::BASE_URI . "/{$this->modeId}", [], $this->getCommonHeaders());
        $this->assertEquals(1000, $updatedDetailResponse['code'], '获取更新后的详情应该成功');

        $updatedDynamicModelFound = false;
        foreach ($updatedDetailResponse['data']['groups'] as $group) {
            foreach ($group['models'] as $model) {
                if (isset($model['model_type']) && $model['model_type'] === 'dynamic' && $model['model_id'] === $createdDynamicModelId) {
                    $updatedDynamicModelFound = true;

                    // 验证更新后的字段
                    $this->assertEquals('智能GPT更新后', $model['model_name'], '模型名称应该已更新');
                    $this->assertEquals('智能GPT动态模型更新后', $model['model_description'], '模型描述应该已更新');
                    $this->assertEquals($createdDynamicModelId, $model['model_id'], 'model_id应该保持不变');
                    $this->assertEquals($createdProviderModelId, $model['provider_model_id'], 'provider_model_id应该保持不变');

                    // 验证更新后的 aggregate_config
                    $this->assertArrayHasKey('aggregate_config', $model);
                    $this->assertNotNull($model['aggregate_config'], 'aggregate_config不应该为空');
                    $this->assertArrayHasKey('models', $model['aggregate_config']);
                    $models = $model['aggregate_config']['models'];
                    $this->assertIsArray($models);
                    // 验证对象数组格式
                    foreach ($models as $subModel) {
                        $this->assertIsArray($subModel);
                        $this->assertArrayHasKey('model_id', $subModel);
                    }
                    // 验证包含预期的子模型
                    $modelIds = array_column($models, 'model_id');
                    $this->assertContains('max', $modelIds, '子模型列表应该包含max');
                    $this->assertContains('doubao-seed-1.8', $modelIds, '子模型列表应该包含doubao-seed-1.8');
                    $this->assertContains('gpt-4o', $modelIds, '子模型列表应该已更新，包含gpt-4o');
                    $this->assertArrayHasKey('strategy_config', $model['aggregate_config']);
                    $this->assertEquals('desc', $model['aggregate_config']['strategy_config']['order'], '策略配置应该已更新');

                    // 验证更新后的多语言翻译
                    $this->assertArrayHasKey('model_translate', $model);
                    $this->assertEquals('Smart GPT Updated', $model['model_translate']['name']['en_US'], '英文名称应该已更新');
                    $this->assertEquals('智能GPT更新后', $model['model_translate']['name']['zh_CN'], '中文名称应该已更新');

                    break 2;
                }
            }
        }

        $this->assertTrue($updatedDynamicModelFound, '应该找到更新后的动态模型');
    }
}
