<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Support;

require_once __DIR__ . '/MagicTestSupportUsesDatabaseIsolation.php';
require_once __DIR__ . '/MagicTestSupportUsesOfficialVideoProviderFixtures.php';

use MagicTestSupport\VideoTesting\UsesOfficialVideoProviderFixtures as SharedUsesOfficialVideoProviderFixtures;

trait UsesOfficialVideoProviderFixtures
{
    use SharedUsesOfficialVideoProviderFixtures;

    /**
     * magic-service 官方视频测试专用组织编码。
     * 这个值会参与查询隔离，不能改成随机值，也不要和真实组织编码复用。
     */
    protected const string TEST_OFFICIAL_ORGANIZATION_CODE = 'official-video-isolation-test-org';

    /**
     * 官方视频测试 fixture 的全局 provider 主键。
     * 该 ID 与企业包共享，用来保证两边命中同一个 Official provider 模板，而不是各造一条。
     */
    protected const int TEST_PROVIDER_ID = 990100000000000001;

    /**
     * magic-service 官方视频测试专用 config 主键。
     * 与 provider 固定绑定，重复跑测试只会 upsert 这条记录。
     */
    protected const int TEST_PROVIDER_CONFIG_ID = 990100000000000101;

    /**
     * magic-service 官方视频测试专用 fast model 主键。
     */
    protected const int TEST_FAST_MODEL_PRIMARY_ID = 990100000000000201;

    /**
     * magic-service 官方视频测试专用 pro model 主键。
     */
    protected const int TEST_PRO_MODEL_PRIMARY_ID = 990100000000000202;

    /**
     * magic-service 官方视频测试专用 fast model 当前版本主键。
     */
    protected const int TEST_FAST_MODEL_CONFIG_VERSION_ID = 990100000000000301;

    /**
     * magic-service 官方视频测试专用 pro model 当前版本主键。
     */
    protected const int TEST_PRO_MODEL_CONFIG_VERSION_ID = 990100000000000302;

    protected function officialVideoFixtureOrganizationCode(): string
    {
        return self::TEST_OFFICIAL_ORGANIZATION_CODE;
    }

    protected function officialVideoFixtureIds(): array
    {
        return [
            'provider_id' => self::TEST_PROVIDER_ID,
            'provider_config_id' => self::TEST_PROVIDER_CONFIG_ID,
            'fast_model_id' => self::TEST_FAST_MODEL_PRIMARY_ID,
            'pro_model_id' => self::TEST_PRO_MODEL_PRIMARY_ID,
            'fast_model_config_version_id' => self::TEST_FAST_MODEL_CONFIG_VERSION_ID,
            'pro_model_config_version_id' => self::TEST_PRO_MODEL_CONFIG_VERSION_ID,
        ];
    }
}
