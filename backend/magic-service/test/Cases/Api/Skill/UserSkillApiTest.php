<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Skill;

use App\Application\File\Service\FileAppService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillMarketModel;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillModel;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillVersionModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskFileModel;
use Hyperf\DbConnection\Db;
use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;
use RuntimeException;
use ZipArchive;

/**
 * @internal
 * 用户技能API测试
 */
class UserSkillApiTest extends AbstractApiTest
{
    private const BASE_URI = '/api/v1/skills';

    private ?string $testFile = null;

    /**
     * @var array<int, string>
     */
    private array $testFiles = [];

    private int $testSkillZipSequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testFile = $this->createTestSkillZip($this->name());
    }

    protected function tearDown(): void
    {
        foreach (array_unique($this->testFiles) as $testFile) {
            if (file_exists($testFile)) {
                unlink($testFile);
            }
        }
        $this->testFiles = [];
        $this->testFile = null;
        $this->testSkillZipSequence = 0;
        parent::tearDown();
    }

    /**
     * 测试技能导入第一阶段：上传文件并解析.
     */
    public function testParseFileImport(): void
    {
        $this->switchUserTest1();

        // 准备测试文件路径（需要准备一个有效的 skill 压缩包）
        $testFile = $this->testFile;

        // 先上传文件到私有存储获取 file_key
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $fileKey = $this->uploadFileAndGetKey($testFile, $organizationCode);
        // 发送 JSON 请求（接收 file_key）
        $requestData = [
            'file_key' => $fileKey,
        ];

        $response = $this->json(
            self::BASE_URI . '/import/parse/file',
            $requestData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('import_token', $response['data']);
        $this->assertArrayHasKey('package_name', $response['data']);
        $this->assertArrayHasKey('package_description', $response['data']);
        $this->assertArrayHasKey('is_update', $response['data']);
        $this->assertArrayHasKey('name_i18n', $response['data']);
        $this->assertArrayHasKey('description_i18n', $response['data']);
        $this->assertArrayHasKey('logo', $response['data']);

        // 根据 is_update 验证返回字段
        if ($response['data']['is_update']) {
            $this->assertArrayHasKey('code', $response['data']);
            $this->assertArrayHasKey('skill_id', $response['data']);
        } else {
            $this->assertNull($response['data']['code'] ?? null);
            $this->assertNull($response['data']['skill_id'] ?? null);
        }
    }

    /**
     * 测试技能导入第一阶段：不再支持多级目录结构.
     */
    public function testParseFileImportRejectsNestedDirectoryStructure(): void
    {
        $this->switchUserTest1();

        $testFile = $this->createTestSkillZip($this->name(), 'level1/level2/skill-dir');

        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $fileKey = $this->uploadFileAndGetKey($testFile, $organizationCode);

        $response = $this->json(
            self::BASE_URI . '/import/parse/file',
            [
                'file_key' => $fileKey,
            ],
            $this->getCommonHeaders()
        );

        $this->assertNotEquals(1000, $response['code'], '多级目录结构不应该再被导入解析');
        $this->assertSame(51253, $response['code']);
    }

    /**
     * 测试技能导入第二阶段：确认信息正式落库.
     */
    public function testImportSkill(): void
    {
        $this->switchUserTest1();

        // 先执行第一阶段获取 import_token
        $testFile = $this->testFile;

        // 先上传文件到私有存储获取 file_key
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $fileKey = $this->uploadFileAndGetKey($testFile, $organizationCode);

        $parseRequestData = [
            'file_key' => $fileKey,
        ];

        $parseResponse = $this->json(
            self::BASE_URI . '/import/parse/file',
            $parseRequestData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $parseResponse['code']);
        $importToken = $parseResponse['data']['import_token'] ?? null;
        $this->assertNotNull($importToken, 'import_token 不应为空');

        // 准备导入请求数据（使用正确的多语言字段格式）
        $requestData = [
            'import_token' => $importToken,
            'name_i18n' => [
                'zh_CN' => '测试技能',
                'en_US' => 'Test Skill',
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个测试技能',
                'en_US' => 'This is a test skill',
            ],
            'logo' => '',
        ];

        // 发送导入请求
        $response = $this->post(
            self::BASE_URI . '/import',
            $requestData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('id', $response['data']);
        $this->assertArrayHasKey('skill_code', $response['data']);
        $this->assertIsString($response['data']['id']);
        $this->assertIsString($response['data']['skill_code']);

        $userSkillCount = Db::table('magic_user_skills')
            ->where('organization_code', $headers['organization-code'])
            ->where('user_id', $headers['user-id'])
            ->where('skill_code', $response['data']['skill_code'])
            ->where('source_type', 'LOCAL_UPLOAD')
            ->count();
        $this->assertSame(1, $userSkillCount, '导入创建 skill 时应该同步写入 user_skills');

        // 验证 token 已失效：再次使用同一个 token 应该报错
        $duplicateResponse = $this->post(
            self::BASE_URI . '/import',
            $requestData,
            $this->getCommonHeaders()
        );

        // 应该返回错误（不等于1000）
        $this->assertNotEquals(1000, $duplicateResponse['code'], 'token 应该在第一次导入后被删除');
    }

    public function testAddSkillFromAgent(): void
    {
        $this->switchUserTest1();

        $response = $this->post(
            self::BASE_URI,
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('id', $response['data']);
        $this->assertArrayHasKey('skill_code', $response['data']);
        $this->assertIsString($response['data']['id']);
        $this->assertIsString($response['data']['skill_code']);

        $skillCode = $response['data']['skill_code'];
        $headers = $this->getCommonHeaders();

        $userSkillCount = Db::table('magic_user_skills')
            ->where('organization_code', $headers['organization-code'])
            ->where('user_id', $headers['user-id'])
            ->where('skill_code', $skillCode)
            ->where('source_type', 'AGENT_CREATED')
            ->count();
        $this->assertSame(1, $userSkillCount, 'Agent 创建 skill 时应该同步写入 user_skills');

        $queryResponse = $this->post(
            self::BASE_URI . '/queries',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $queryResponse['code'], $queryResponse['message'] ?? '');

        $found = false;
        foreach ($queryResponse['data']['list'] as $item) {
            if (($item['code'] ?? '') === $skillCode) {
                $found = true;
                $this->assertEquals('AGENT_CREATED', $item['source_type']);
                break;
            }
        }

        $this->assertTrue($found, '通过 Agent 创建的技能应该出现在列表中');

        $detailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code'], $detailResponse['message'] ?? '');
        $this->assertSame('', $detailResponse['data']['file_key']);
    }

    /**
     * 测试查询技能列表.
     */
    public function testQueries(): void
    {
        $this->switchUserTest1();

        // 先导入一个技能作为测试数据
        $testFile = $this->testFile;

        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $fileKey = $this->uploadFileAndGetKey($testFile, $organizationCode);

        // 第一阶段：解析文件
        $parseRequestData = ['file_key' => $fileKey];
        $parseResponse = $this->json(
            self::BASE_URI . '/import/parse/file',
            $parseRequestData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $parseResponse['code']);
        $importToken = $parseResponse['data']['import_token'] ?? null;
        $this->assertNotNull($importToken);

        // 第二阶段：导入技能
        $importRequestData = [
            'import_token' => $importToken,
            'name_i18n' => [
                'zh_CN' => '测试技能查询',
                'en_US' => 'Test Skill Query',
            ],
            'description_i18n' => [
                'zh_CN' => '用于测试查询的技能',
                'en_US' => 'Skill for testing queries',
            ],
            'logo' => '',
        ];
        $importResponse = $this->post(
            self::BASE_URI . '/import',
            $importRequestData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $importResponse['code']);
        $skillId = $importResponse['data']['id'] ?? null;
        $skillCode = $importResponse['data']['skill_code'] ?? null;
        $this->assertNotNull($skillId);
        $this->assertNotNull($skillCode);

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
            $this->assertIsString($item['id']);
            $this->assertArrayHasKey('code', $item);
            $this->assertArrayHasKey('name_i18n', $item);
            $this->assertArrayHasKey('description_i18n', $item);
            $this->assertArrayHasKey('logo', $item);
            $this->assertArrayHasKey('source_type', $item);
            $this->assertArrayHasKey('is_enabled', $item);
            $this->assertArrayHasKey('pinned_at', $item);
            $this->assertArrayHasKey('latest_published_at', $item);
            $this->assertArrayHasKey('latest_version', $item);
            $this->assertArrayHasKey('updated_at', $item);
            $this->assertArrayHasKey('created_at', $item);
        }

        $queriedSkill = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? '') === $skillCode) {
                $queriedSkill = $item;
                break;
            }
        }
        $this->assertNotNull($queriedSkill, '基础技能列表中应该能查到刚创建的技能');
        $this->assertSame('', $queriedSkill['latest_version'] ?? null);

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
        // 验证搜索结果中包含关键词
        $found = false;
        foreach ($keywordResponse['data']['list'] as $item) {
            $nameZh = $item['name_i18n']['zh_CN'] ?? '';
            $descZh = $item['description_i18n']['zh_CN'] ?? '';
            if (str_contains($nameZh, '测试') || str_contains($descZh, '测试')) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, '搜索结果应包含关键词');

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
        // 如果找到结果，验证结果中包含关键词
        if ($keywordEnResponse['data']['total'] > 0) {
            $foundEn = false;
            foreach ($keywordEnResponse['data']['list'] as $item) {
                $nameEn = $item['name_i18n']['en_US'] ?? '';
                $descEn = $item['description_i18n']['en_US'] ?? '';
                if (stripos($nameEn, 'Test') !== false || stripos($descEn, 'Test') !== false) {
                    $foundEn = true;
                    break;
                }
            }
            $this->assertTrue($foundEn, '搜索结果应包含英文关键词');
        }

        // 测试不存在的关键词搜索
        $notFoundKeywordData = [
            'page' => 1,
            'page_size' => 20,
            'keyword' => '不存在的关键词123456789',
        ];
        $notFoundResponse = $this->post(
            self::BASE_URI . '/queries',
            $notFoundKeywordData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $notFoundResponse['code']);
        $this->assertEquals(0, $notFoundResponse['data']['total']);
        $this->assertCount(0, $notFoundResponse['data']['list']);

        // 测试空关键词搜索
        $emptyKeywordData = [
            'page' => 1,
            'page_size' => 20,
            'keyword' => '',
        ];
        $emptyKeywordResponse = $this->post(
            self::BASE_URI . '/queries',
            $emptyKeywordData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $emptyKeywordResponse['code']);
        $this->assertGreaterThanOrEqual(1, $emptyKeywordResponse['data']['total']);

        // 测试来源类型筛选 - LOCAL_UPLOAD
        $sourceTypeQueryData = [
            'page' => 1,
            'page_size' => 20,
            'source_type' => 'LOCAL_UPLOAD',
        ];
        $sourceTypeResponse = $this->post(
            self::BASE_URI . '/queries',
            $sourceTypeQueryData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $sourceTypeResponse['code']);
        $this->assertGreaterThanOrEqual(1, $sourceTypeResponse['data']['total']);

        // 验证筛选结果中的 source_type 都是 LOCAL_UPLOAD
        foreach ($sourceTypeResponse['data']['list'] as $item) {
            $this->assertEquals('LOCAL_UPLOAD', $item['source_type']);
        }

        // 测试组合搜索（关键词 + 来源类型）
        $combinedQueryData = [
            'page' => 1,
            'page_size' => 20,
            'keyword' => '测试',
            'source_type' => 'LOCAL_UPLOAD',
        ];
        $combinedResponse = $this->post(
            self::BASE_URI . '/queries',
            $combinedQueryData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $combinedResponse['code']);
        $this->assertGreaterThanOrEqual(0, $combinedResponse['data']['total']);
        // 验证结果同时满足关键词和来源类型条件
        foreach ($combinedResponse['data']['list'] as $item) {
            $this->assertEquals('LOCAL_UPLOAD', $item['source_type']);
        }

        // 测试分页 - 第一页
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

        // 测试分页 - 第二页
        if ($pageResponse['data']['total'] > 1) {
            $page2QueryData = [
                'page' => 2,
                'page_size' => 1,
            ];
            $page2Response = $this->post(
                self::BASE_URI . '/queries',
                $page2QueryData,
                $this->getCommonHeaders()
            );
            $this->assertEquals(1000, $page2Response['code']);
            $this->assertLessThanOrEqual(1, count($page2Response['data']['list']));
            $this->assertEquals(2, $page2Response['data']['page']);
            $this->assertEquals(1, $page2Response['data']['page_size']);
            // 验证不同页的数据不同（如果有数据）
            if (count($pageResponse['data']['list']) > 0 && count($page2Response['data']['list']) > 0) {
                $this->assertNotEquals(
                    $pageResponse['data']['list'][0]['id'],
                    $page2Response['data']['list'][0]['id'],
                    '不同页的数据应该不同'
                );
            }
        }

        // 测试最大分页大小
        $maxPageSizeData = [
            'page' => 1,
            'page_size' => 100,
        ];
        $maxPageSizeResponse = $this->post(
            self::BASE_URI . '/queries',
            $maxPageSizeData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $maxPageSizeResponse['code']);
        $this->assertLessThanOrEqual(100, count($maxPageSizeResponse['data']['list']));
    }

    public function testQueriesUseInstalledVersionSnapshotForNonCreator(): void
    {
        $this->switchUserTest1();

        $skillCode = $this->createTestSkill();

        $publishedInfo = [
            'name_i18n' => [
                'default' => '已发布技能名称',
                'zh_CN' => '已发布技能名称',
                'en_US' => 'Published Skill Name',
            ],
            'description_i18n' => [
                'zh_CN' => '已发布技能描述',
                'en_US' => 'Published Skill Description',
            ],
            'logo' => 'skill/published-logo.png',
        ];
        $publishedInfoResponse = $this->put(
            self::BASE_URI . '/' . $skillCode . '/info',
            $publishedInfo,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $publishedInfoResponse['code']);

        $publishResponse = $this->publishSkillVersion($skillCode, IdGenerator::getUniqueId32(), 'MARKET');
        $this->assertEquals(1000, $publishResponse['code']);
        $versionId = $publishResponse['data']['version_id'] ?? null;
        $this->assertNotNull($versionId);

        $approveResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId . '/review',
            [
                'action' => 'APPROVED',
                'publisher_type' => 'USER',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $approveResponse['code']);

        $draftInfo = [
            'name_i18n' => [
                'default' => '已发布技能名称',
                'zh_CN' => '草稿技能名称',
                'en_US' => 'Draft Skill Name',
            ],
            'description_i18n' => [
                'zh_CN' => '草稿技能描述',
                'en_US' => 'Draft Skill Description',
            ],
            'logo' => 'skill/draft-logo.png',
        ];
        $draftInfoResponse = $this->put(
            self::BASE_URI . '/' . $skillCode . '/info',
            $draftInfo,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $draftInfoResponse['code']);

        $storeSkill = SkillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->where('publish_status', 'PUBLISHED')
            ->first();
        $this->assertNotNull($storeSkill);

        $this->switchUserTest2();

        $addResponse = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $storeSkill->id,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $addResponse['code']);

        $queryResponse = $this->post(
            self::BASE_URI . '/queries',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $queryResponse['code']);

        $targetSkill = null;
        foreach ($queryResponse['data']['list'] as $item) {
            if (($item['code'] ?? '') === $skillCode) {
                $targetSkill = $item;
                break;
            }
        }

        $this->assertNotNull($targetSkill, 'Installed skill should be returned in the visible skill list');
        $this->assertEquals('已发布技能名称', $targetSkill['name_i18n']['zh_CN'] ?? null);
        $this->assertEquals('Published Skill Name', $targetSkill['name_i18n']['en_US'] ?? null);
        $this->assertEquals('已发布技能描述', $targetSkill['description_i18n']['zh_CN'] ?? null);
        $this->assertEquals('Published Skill Description', $targetSkill['description_i18n']['en_US'] ?? null);
        $this->assertEquals('MARKET', $targetSkill['source_type'] ?? null);
    }

    public function testQueriesCreated(): void
    {
        $this->switchUserTest1();

        $skillCode = $this->createTestSkill();

        $response = $this->post(
            self::BASE_URI . '/queries/created',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $targetSkill = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? '') === $skillCode) {
                $targetSkill = $item;
                break;
            }
        }

        $this->assertNotNull($targetSkill, '我创建的技能应该出现在 queries/created 列表中');
        $this->assertSame('LOCAL_UPLOAD', $targetSkill['source_type'] ?? null);
        $this->assertArrayHasKey('creator_info', $targetSkill);
        $this->assertSame('', $targetSkill['latest_version'] ?? null);
        $this->assertSame($this->getCommonHeaders()['user-id'], $targetSkill['creator_info']['id'] ?? null);
    }

    public function testQueriesTeamShared(): void
    {
        $this->switchUserTest1();

        $createdSkillCode = $this->createTestSkill();

        $sharedSkillCode = $this->createTestSkill();
        $publishedInfoResponse = $this->put(
            self::BASE_URI . '/' . $sharedSkillCode . '/info',
            [
                'name_i18n' => [
                    'zh_CN' => '团队共享已发布名称',
                    'en_US' => 'Team Shared Published Name',
                ],
                'description_i18n' => [
                    'zh_CN' => '团队共享已发布描述',
                    'en_US' => 'Team Shared Published Description',
                ],
                'logo' => 'skill/team-shared-published-logo.png',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $publishedInfoResponse['code']);
        $publishResponse = $this->publishSkillVersion($sharedSkillCode, '1.0.0', 'ORGANIZATION');
        $this->assertEquals(1000, $publishResponse['code']);
        $draftInfoResponse = $this->put(
            self::BASE_URI . '/' . $sharedSkillCode . '/info',
            [
                'name_i18n' => [
                    'zh_CN' => '团队共享草稿名称',
                    'en_US' => 'Team Shared Draft Name',
                ],
                'description_i18n' => [
                    'zh_CN' => '团队共享草稿描述',
                    'en_US' => 'Team Shared Draft Description',
                ],
                'logo' => 'skill/team-shared-draft-logo.png',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $draftInfoResponse['code']);

        $marketSkillData = $this->createPublishedStoreSkill();

        $this->switchUserTest2();

        $addResponse = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $marketSkillData['store_skill_id'],
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $addResponse['code']);

        $response = $this->post(
            self::BASE_URI . '/queries/team-shared',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $skillCodes = array_column($response['data']['list'], 'code');

        $this->assertContains($sharedSkillCode, $skillCodes, '团队共享技能应该出现在 queries/team-shared 列表中');
        $this->assertNotContains($createdSkillCode, $skillCodes, '我创建的技能不应该出现在 queries/team-shared 列表中');
        $this->assertNotContains($marketSkillData['skill_code'], $skillCodes, '从市场安装的技能不应该出现在 queries/team-shared 列表中');

        $targetSkill = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? '') === $sharedSkillCode) {
                $targetSkill = $item;
                break;
            }
        }

        $this->assertNotNull($targetSkill, '团队共享技能应该出现在 queries/team-shared 列表中');
        $this->assertNotSame('MARKET', $targetSkill['source_type'] ?? null);
        $this->assertSame('团队共享已发布名称', $targetSkill['name_i18n']['zh_CN'] ?? null);
        $this->assertSame('Team Shared Published Name', $targetSkill['name_i18n']['en_US'] ?? null);
        $this->assertSame('团队共享已发布描述', $targetSkill['description_i18n']['zh_CN'] ?? null);
        $this->assertSame('Team Shared Published Description', $targetSkill['description_i18n']['en_US'] ?? null);
        $this->assertSame('1.0.0', $targetSkill['latest_version'] ?? null);
        $this->assertArrayHasKey('creator_info', $targetSkill);
        $this->assertNotEmpty($targetSkill['creator_info']['id'] ?? null);
    }

    public function testQueriesMarketInstalled(): void
    {
        $storeSkillData = $this->createPublishedStoreSkill();

        $this->switchUserTest1();
        $draftInfoResponse = $this->put(
            self::BASE_URI . '/' . $storeSkillData['skill_code'] . '/info',
            [
                'name_i18n' => [
                    'zh_CN' => '市场安装草稿名称',
                    'en_US' => 'Market Installed Draft Name',
                ],
                'description_i18n' => [
                    'zh_CN' => '市场安装草稿描述',
                    'en_US' => 'Market Installed Draft Description',
                ],
                'logo' => 'skill/market-installed-draft-logo.png',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $draftInfoResponse['code']);

        $this->switchUserTest2();

        $addResponse = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $storeSkillData['store_skill_id'],
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $addResponse['code']);

        $response = $this->post(
            self::BASE_URI . '/queries/market-installed',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $targetSkill = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['code'] ?? '') === $storeSkillData['skill_code']) {
                $targetSkill = $item;
                break;
            }
        }

        $this->assertNotNull($targetSkill, '从市场安装的技能应该出现在 queries/market-installed 列表中');
        $this->assertSame('MARKET', $targetSkill['source_type'] ?? null);
        $this->assertSame('测试技能', $targetSkill['name_i18n']['zh_CN'] ?? null);
        $this->assertSame('Test Skill', $targetSkill['name_i18n']['en_US'] ?? null);
        $this->assertSame('1.0.0', $targetSkill['latest_version'] ?? null);
        $this->assertArrayHasKey('creator_info', $targetSkill);
        $this->assertNotEmpty($targetSkill['creator_info']['id'] ?? null);
    }

    /**
     * 测试获取技能详情.
     */
    public function testGetSkillDetail(): void
    {
        $this->switchUserTest1();

        // 先导入一个技能作为测试数据
        $skillCode = $this->createTestSkill();

        // 获取技能详情
        $response = $this->get(
            self::BASE_URI . '/' . $skillCode,
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
        $this->assertArrayHasKey('version_id', $data);
        $this->assertArrayHasKey('version_code', $data);
        $this->assertArrayHasKey('source_type', $data);
        $this->assertArrayHasKey('is_enabled', $data);
        $this->assertArrayHasKey('pinned_at', $data);
        $this->assertArrayHasKey('name_i18n', $data);
        $this->assertArrayHasKey('description_i18n', $data);
        $this->assertArrayHasKey('logo', $data);
        $this->assertArrayHasKey('package_name', $data);
        $this->assertArrayHasKey('package_description', $data);
        $this->assertArrayHasKey('file_key', $data);
        $this->assertArrayHasKey('source_id', $data);
        $this->assertArrayHasKey('source_meta', $data);
        $this->assertArrayHasKey('latest_published_at', $data);
        $this->assertArrayHasKey('publish_type', $data);
        $this->assertArrayHasKey('allowed_publish_target_types', $data);
        $this->assertArrayHasKey('created_at', $data);
        $this->assertArrayHasKey('updated_at', $data);

        // 验证字段类型和值
        $this->assertIsString($data['id']);
        $this->assertEquals($skillCode, $data['code']);
        $this->assertEquals('LOCAL_UPLOAD', $data['source_type']);
        $this->assertIsInt($data['is_enabled']);
        $this->assertIsArray($data['name_i18n']);
        $this->assertIsArray($data['description_i18n']);
        $this->assertNull($data['latest_published_at']);
        $this->assertNull($data['publish_type']);
        $this->assertSame([], $data['allowed_publish_target_types']);

        // 测试不存在的技能
        $notFoundResponse = $this->get(
            self::BASE_URI . '/non_existent_skill_code_12345',
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的技能应该返回错误');
    }

    /**
     * 测试删除技能.
     */
    public function testDeleteSkill(): void
    {
        $this->switchUserTest1();

        // 创建一个已上架的技能，验证 owner 删除时会同步清理版本并下架市场
        $storeSkillData = $this->createPublishedStoreSkill();
        $skillCode = $storeSkillData['skill_code'];

        // 删除技能
        $response = $this->delete(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertEmpty($response['data'], '删除成功应返回空数组');

        // 验证技能已被删除：再次获取应该返回错误
        $getResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $getResponse['code'], '已删除的技能应该返回错误');

        $deletedVersionCount = Db::table('magic_skill_versions')
            ->where('code', $skillCode)
            ->whereNotNull('deleted_at')
            ->count();
        $this->assertGreaterThan(0, $deletedVersionCount, '所有技能版本都应该被软删除');

        $storeSkill = SkillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->first();
        $this->assertNotNull($storeSkill);
        $this->assertEquals('OFFLINE', $storeSkill->publish_status, '删除 owner 技能后，市场记录应该下架');

        // 测试删除不存在的技能
        $notFoundResponse = $this->delete(
            self::BASE_URI . '/non_existent_skill_code_12345',
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的技能应该返回错误');
    }

    public function testDeleteMarketInstalledSkill(): void
    {
        $this->switchUserTest1();
        $storeSkillData = $this->createPublishedStoreSkill();
        $storeSkillId = $storeSkillData['store_skill_id'];
        $skillCode = $storeSkillData['skill_code'];

        $this->switchUserTest2();
        $addResponse = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $storeSkillId,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $addResponse['code']);

        $deleteResponse = $this->delete(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $deleteResponse['code'], $deleteResponse['message'] ?? '');

        $deletedDetailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $deletedDetailResponse['code'], '市场添加的技能删除后，对当前用户应不可见');

        $reAddResponse = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $storeSkillId,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $reAddResponse['code'], '删除后应该允许再次从市场添加');

        $this->switchUserTest1();
        $ownerDetailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $ownerDetailResponse['code'], '市场安装用户删除后，不应影响 owner 的技能可见性');
    }

    /**
     * 测试更新技能基本信息.
     */
    public function testUpdateSkillInfo(): void
    {
        $this->switchUserTest1();

        // 先导入一个技能作为测试数据
        $skillCode = $this->createTestSkill();

        // 更新技能信息
        $updateData = [
            'name_i18n' => [
                'default' => '已发布技能名称',
                'zh_CN' => '更新后的技能名称',
                'en_US' => 'Updated Skill Name',
            ],
            'description_i18n' => [
                'zh_CN' => '更新后的技能描述',
                'en_US' => 'Updated Skill Description',
            ],
            'logo' => '',
        ];

        $response = $this->put(
            self::BASE_URI . '/' . $skillCode . '/info',
            $updateData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertEmpty($response['data'], '更新成功应返回空数组');

        // 验证更新是否生效：获取技能详情
        $detailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $detailData = $detailResponse['data'];
        $this->assertEquals('更新后的技能名称', $detailData['name_i18n']['zh_CN']);
        $this->assertEquals('Updated Skill Name', $detailData['name_i18n']['en_US']);
        $this->assertEquals('更新后的技能描述', $detailData['description_i18n']['zh_CN']);
        $this->assertEquals('Updated Skill Description', $detailData['description_i18n']['en_US']);

        // 测试部分更新（只更新 name_i18n）
        $partialUpdateData = [
            'name_i18n' => [
                'default' => '已发布技能名称',
                'zh_CN' => '部分更新的技能名称',
                'en_US' => 'Partially Updated Skill Name',
            ],
        ];
        $partialResponse = $this->put(
            self::BASE_URI . '/' . $skillCode . '/info',
            $partialUpdateData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $partialResponse['code']);

        // 验证部分更新：description_i18n 应该保持不变
        $partialDetailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $partialDetailResponse['code']);
        $partialDetailData = $partialDetailResponse['data'];
        $this->assertEquals('部分更新的技能名称', $partialDetailData['name_i18n']['zh_CN']);
        $this->assertEquals('更新后的技能描述', $partialDetailData['description_i18n']['zh_CN'], 'description_i18n 应该保持不变');

        // 测试更新不存在的技能
        $notFoundResponse = $this->put(
            self::BASE_URI . '/non_existent_skill_code_12345/info',
            $updateData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的技能应该返回错误');
    }

    /**
     * 测试发布技能到商店.
     */
    public function testPublishSkill(): void
    {
        $this->switchUserTest1();

        // 先导入一个技能作为测试数据
        $skillCode = $this->createTestSkill();

        // 私有发布技能
        $response = $this->publishSkillVersion($skillCode, '1.0.0', 'PRIVATE');

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertArrayHasKey('version_id', $response['data']);
        $this->assertEquals('PUBLISHED', $response['data']['publish_status']);
        $this->assertEquals('APPROVED', $response['data']['review_status']);
        $this->assertEquals('PRIVATE', $response['data']['publish_target_type']);
        $this->assertTrue($response['data']['is_current_version']);
        $this->assertNotNull($response['data']['published_at']);

        // 验证版本已创建：查询数据库获取版本ID
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $versionId = $response['data']['version_id'] ?? null;
        $this->assertNotNull($versionId, '应该创建了技能版本');

        // 验证版本状态为已发布且审核通过
        $version = $this->getSkillVersionById($versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertEquals('PUBLISHED', $version['publish_status']);
        $this->assertEquals('APPROVED', $version['review_status']);
        $this->assertEquals('PRIVATE', $version['publish_target_type']);
        $this->assertEquals(1, $version['is_current_version']);
        $this->assertNotNull($version['published_at']);
        $this->assertNotEmpty($version['skill_file_key']);

        $skill = SkillModel::query()
            ->where('code', $skillCode)
            ->where('organization_code', $organizationCode)
            ->first();
        $this->assertNotNull($skill);

        $projectSkillFile = TaskFileModel::query()
            ->where('project_id', $skill->project_id)
            ->where('file_name', 'SKILL.md')
            ->where('is_directory', 0)
            ->orderByDesc('file_id')
            ->first();
        $this->assertNotNull($projectSkillFile);
        $this->assertNotSame($projectSkillFile->file_key, $version['skill_file_key']);

        $detailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $this->assertEquals($version['published_at'], $detailResponse['data']['latest_published_at']);
        $this->assertSame('INTERNAL', $detailResponse['data']['publish_type']);
        $this->assertSame(['PRIVATE', 'MEMBER', 'ORGANIZATION'], $detailResponse['data']['allowed_publish_target_types']);

        $duplicateResponse = $this->publishSkillVersion($skillCode, '1.0.0', 'PRIVATE');
        $this->assertNotEquals(1000, $duplicateResponse['code'], '重复版本号应该返回错误');

        $notFoundResponse = $this->publishSkillVersion('non_existent_skill_code_12345', '9.9.9', 'PRIVATE');
        $this->assertNotEquals(1000, $notFoundResponse['code'], '不存在的技能应该返回错误');
    }

    public function testPublishSkillScopeTransitions(): void
    {
        $this->switchUserTest1();

        $skillCode = $this->createTestSkill();
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $creatorId = $headers['user-id'];

        $privateResponse = $this->publishSkillVersion($skillCode, '1.0.0', 'PRIVATE');
        $this->assertEquals(1000, $privateResponse['code']);
        $privateVisibility = $this->getSkillVisibilityRows($organizationCode, $skillCode);
        $this->assertCount(1, $privateVisibility);
        $this->assertSame('1', (string) $privateVisibility[0]['principal_type']);
        $this->assertSame($creatorId, $privateVisibility[0]['principal_id']);

        $organizationResponse = $this->publishSkillVersion($skillCode, '1.0.1', 'ORGANIZATION');
        $this->assertEquals(1000, $organizationResponse['code']);
        $organizationVisibility = $this->getSkillVisibilityRows($organizationCode, $skillCode);
        $this->assertCount(1, $organizationVisibility);
        $this->assertSame('3', (string) $organizationVisibility[0]['principal_type']);
        $this->assertSame($organizationCode, $organizationVisibility[0]['principal_id']);

        $memberTargetUserId = 'target-user-001';
        $memberResponse = $this->publishSkillVersion(
            $skillCode,
            '1.0.2',
            'MEMBER',
            null,
            [
                'user_ids' => [$memberTargetUserId],
            ]
        );
        $this->assertEquals(1000, $memberResponse['code']);
        $memberVisibility = $this->getSkillVisibilityRows($organizationCode, $skillCode);
        $memberVisibilityUserIds = array_column($memberVisibility, 'principal_id');
        sort($memberVisibilityUserIds);
        $expectedMemberVisibilityUserIds = [$creatorId, $memberTargetUserId];
        sort($expectedMemberVisibilityUserIds);
        $this->assertSame($expectedMemberVisibilityUserIds, $memberVisibilityUserIds);

        $detailResponse = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailResponse['code']);
        $this->assertSame('INTERNAL', $detailResponse['data']['publish_type']);
        $this->assertSame(['PRIVATE', 'MEMBER', 'ORGANIZATION'], $detailResponse['data']['allowed_publish_target_types']);

        $marketResponse = $this->publishSkillVersion($skillCode, '1.0.3', 'MARKET', null, null, 'MARKET');
        $this->assertEquals(1000, $marketResponse['code']);
        $marketVisibility = $this->getSkillVisibilityRows($organizationCode, $skillCode);
        $marketVisibilityUserIds = array_column($marketVisibility, 'principal_id');
        sort($marketVisibilityUserIds);
        $this->assertSame($memberVisibilityUserIds, $marketVisibilityUserIds);

        $versionId = $marketResponse['data']['version_id'] ?? null;
        $this->assertNotNull($versionId);
        $approveResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId . '/review',
            [
                'action' => 'APPROVED',
                'publisher_type' => 'USER',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $approveResponse['code']);

        $storeSkill = SkillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->where('publish_status', 'PUBLISHED')
            ->first();
        $this->assertNotNull($storeSkill);

        $this->switchUserTest2();
        $user2Headers = $this->getCommonHeaders();
        $addResponse = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $storeSkill->id,
            ],
            $user2Headers
        );
        $this->assertEquals(1000, $addResponse['code']);

        $visibilityAfterStoreAdd = $this->getSkillVisibilityRows($organizationCode, $skillCode);
        $visibilityAfterStoreAddUserIds = array_column($visibilityAfterStoreAdd, 'principal_id');
        sort($visibilityAfterStoreAddUserIds);
        $expectedUserIds = [$creatorId, $memberTargetUserId, $user2Headers['user-id']];
        sort($expectedUserIds);
        $this->assertSame($expectedUserIds, $visibilityAfterStoreAddUserIds);

        $this->switchUserTest1();
        $republishPrivateResponse = $this->publishSkillVersion($skillCode, '1.0.4', 'PRIVATE');
        $this->assertEquals(1000, $republishPrivateResponse['code']);

        $visibilityAfterRepublishPrivate = $this->getSkillVisibilityRows($organizationCode, $skillCode);
        $this->assertCount(1, $visibilityAfterRepublishPrivate);
        $this->assertSame($creatorId, $visibilityAfterRepublishPrivate[0]['principal_id']);

        $userSkillRows = $this->getUserSkillRows($organizationCode, $skillCode);
        $this->assertCount(1, $userSkillRows);
        $this->assertSame($creatorId, $userSkillRows[0]['user_id']);

        $storeSkill->refresh();
        $this->assertSame('OFFLINE', $storeSkill->publish_status);
    }

    public function testPublishSkillToMemberRequiresTargets(): void
    {
        $this->switchUserTest1();

        $skillCode = $this->createTestSkill();
        $response = $this->publishSkillVersion($skillCode, '1.0.0', 'MEMBER', null, [
            'user_ids' => [],
            'department_ids' => [],
        ], 'INTERNAL');

        $this->assertNotEquals(1000, $response['code'], '成员发布未选择成员/部门时应该返回错误');
    }

    /**
     * 测试审核技能版本.
     */
    public function testReviewSkillVersion(): void
    {
        $this->switchUserTest1();

        // 先导入并发布一个技能
        $skillCode = $this->createTestSkill();

        // 发布到市场
        $publishResponse = $this->publishSkillVersion($skillCode, IdGenerator::getUniqueId32(), 'MARKET');
        $this->assertEquals(1000, $publishResponse['code']);

        // 获取版本ID
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $versionId = $publishResponse['data']['version_id'] ?? null;
        $this->assertNotNull($versionId, '应该创建了技能版本');

        // 测试审核通过
        $approveData = [
            'action' => 'APPROVED',
            'publisher_type' => 'USER',
        ];
        $approveResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId . '/review',
            $approveData,
            $this->getCommonHeaders()
        );

        // 验证审核通过响应
        $this->assertEquals(1000, $approveResponse['code'], $approveResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $approveResponse);
        $this->assertIsArray($approveResponse['data']);
        $this->assertEmpty($approveResponse['data'], '审核成功应返回空数组');

        // 验证版本状态已更新为已发布
        $version = $this->getSkillVersionById($versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertEquals('PUBLISHED', $version['publish_status']);
        $this->assertEquals('APPROVED', $version['review_status']);

        $detailAfterApprove = $this->get(
            self::BASE_URI . '/' . $skillCode,
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $detailAfterApprove['code']);
        $this->assertNotNull($detailAfterApprove['data']['latest_published_at']);

        // 再次发布技能创建新版本
        $publishResponse2 = $this->publishSkillVersion($skillCode, IdGenerator::getUniqueId32(), 'MARKET');
        $this->assertEquals(1000, $publishResponse2['code']);

        $versionId2 = $publishResponse2['data']['version_id'] ?? null;
        $this->assertNotNull($versionId2);
        $this->assertNotEquals($versionId, $versionId2, '应该创建了新版本');

        // 测试审核拒绝
        $rejectData = [
            'action' => 'REJECTED',
        ];
        $rejectResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId2 . '/review',
            $rejectData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $rejectResponse['code']);

        // 验证版本状态已更新为拒绝
        $version2 = $this->getSkillVersionById($versionId2, $organizationCode);
        $this->assertNotNull($version2);
        $this->assertEquals('REJECTED', $version2['review_status']);
        $this->assertEquals(0, $version2['is_current_version']);

        // 测试无效的审核操作
        $invalidData = [
            'action' => 'INVALID_ACTION',
        ];
        $invalidResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId2 . '/review',
            $invalidData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $invalidResponse['code'], '无效的审核操作应该返回错误');
    }

    /**
     * 测试下架技能版本.
     */
    public function testOfflineSkill(): void
    {
        $this->switchUserTest1();

        // 先导入、发布并审核通过一个技能
        $skillCode = $this->createTestSkill();

        // 发布技能到市场
        $publishResponse = $this->publishSkillVersion($skillCode, '1.0.0', 'MARKET');
        $this->assertEquals(1000, $publishResponse['code']);

        // 获取版本ID并审核通过
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $versionId = $publishResponse['data']['version_id'] ?? null;
        $this->assertNotNull($versionId);

        // 审核通过
        $approveData = [
            'action' => 'APPROVED',
            'publisher_type' => 'USER',
        ];
        $approveResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId . '/review',
            $approveData,
            $this->getCommonHeaders()
        );

        // 如果返回权限错误，跳过测试
        if (isset($approveResponse['code']) && in_array($approveResponse['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口需要管理员权限，跳过测试');
            return;
        }

        $this->assertEquals(1000, $approveResponse['code']);

        // 下架技能
        $offlineResponse = $this->put(
            self::BASE_URI . '/' . $skillCode . '/offline',
            [],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $offlineResponse['code'], $offlineResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $offlineResponse);
        $this->assertIsArray($offlineResponse['data']);
        $this->assertEmpty($offlineResponse['data'], '下架成功应返回空数组');

        // 验证版本状态已更新为下架
        $version = $this->getSkillVersionById($versionId, $organizationCode);
        $this->assertNotNull($version);
        $this->assertEquals('OFFLINE', $version['publish_status']);

        // 测试下架没有已发布版本的技能应该返回错误
        $skillCode2 = $this->createTestSkill();
        $noPublishedResponse = $this->put(
            self::BASE_URI . '/' . $skillCode2 . '/offline',
            [],
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $noPublishedResponse['code'], '没有已发布版本的技能应该返回错误');
    }

    /**
     * 测试获取市场技能库列表.
     */
    public function testGetStoreSkillsList(): void
    {
        $this->switchUserTest1();

        // 测试基本查询
        $response = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('list', $response['data']);
        $this->assertArrayHasKey('total', $response['data']);
        $this->assertArrayHasKey('page', $response['data']);
        $this->assertArrayHasKey('page_size', $response['data']);
        $this->assertIsInt($response['data']['total']);
        $this->assertIsArray($response['data']['list']);
        $this->assertIsInt($response['data']['page']);
        $this->assertIsInt($response['data']['page_size']);

        // 验证列表项结构
        if (count($response['data']['list']) > 0) {
            $item = $response['data']['list'][0];
            $this->assertArrayHasKey('id', $item);
            $this->assertArrayHasKey('skill_code', $item);
            $this->assertArrayHasKey('name_i18n', $item);
            $this->assertArrayHasKey('description_i18n', $item);
            $this->assertArrayHasKey('logo', $item);
            $this->assertArrayHasKey('publisher_type', $item);
            $this->assertArrayHasKey('publisher', $item);
            $this->assertArrayHasKey('publish_status', $item);
            $this->assertArrayHasKey('is_added', $item);
            $this->assertArrayHasKey('need_upgrade', $item);
            $this->assertArrayHasKey('is_creator', $item);
            $this->assertArrayHasKey('created_at', $item);
            $this->assertArrayHasKey('updated_at', $item);

            // 验证字段类型
            $this->assertIsString($item['id']);
            $this->assertIsString($item['skill_code']);
            $this->assertIsArray($item['name_i18n']);
            $this->assertIsArray($item['description_i18n']);
            $this->assertIsString($item['publisher_type']);
            $this->assertIsArray($item['publisher']);
            $this->assertIsString($item['publish_status']);
            $this->assertIsBool($item['is_added']);
            $this->assertIsBool($item['need_upgrade']);
            $this->assertIsBool($item['is_creator']);

            // 验证 publisher 对象结构
            $this->assertArrayHasKey('name', $item['publisher']);
            $this->assertArrayHasKey('avatar', $item['publisher']);
            $this->assertIsString($item['publisher']['name']);
            $this->assertIsString($item['publisher']['avatar']);

            // 验证 publish_status 固定为 PUBLISHED
            $this->assertEquals('PUBLISHED', $item['publish_status']);
        }

        // 测试关键词搜索（中文）
        $keywordResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'keyword' => '搜索',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $keywordResponse['code']);
        $this->assertIsInt($keywordResponse['data']['total']);
        // 如果找到结果，验证结果中包含关键词
        if ($keywordResponse['data']['total'] > 0) {
            $found = false;
            foreach ($keywordResponse['data']['list'] as $item) {
                $nameZh = $item['name_i18n']['zh_CN'] ?? '';
                $descZh = $item['description_i18n']['zh_CN'] ?? '';
                if (str_contains($nameZh, '搜索') || str_contains($descZh, '搜索')) {
                    $found = true;
                    break;
                }
            }
            $this->assertTrue($found, '搜索结果应包含关键词');
        }

        // 测试关键词搜索（英文）
        $keywordEnResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'keyword' => 'Search',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $keywordEnResponse['code']);
        $this->assertIsInt($keywordEnResponse['data']['total']);
        // 如果找到结果，验证结果中包含关键词
        if ($keywordEnResponse['data']['total'] > 0) {
            $foundEn = false;
            foreach ($keywordEnResponse['data']['list'] as $item) {
                $nameEn = $item['name_i18n']['en_US'] ?? '';
                $descEn = $item['description_i18n']['en_US'] ?? '';
                if (stripos($nameEn, 'Search') !== false || stripos($descEn, 'Search') !== false) {
                    $foundEn = true;
                    break;
                }
            }
            $this->assertTrue($foundEn, '搜索结果应包含英文关键词');
        }

        // 测试不存在的关键词搜索
        $notFoundKeywordResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'keyword' => '不存在的关键词123456789',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $notFoundKeywordResponse['code']);
        $this->assertIsInt($notFoundKeywordResponse['data']['total']);

        // 测试发布者类型筛选 - OFFICIAL
        $publisherTypeResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'publisher_type' => 'OFFICIAL',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $publisherTypeResponse['code']);
        $this->assertIsInt($publisherTypeResponse['data']['total']);
        // 验证筛选结果中的 publisher_type 都是 OFFICIAL
        foreach ($publisherTypeResponse['data']['list'] as $item) {
            $this->assertEquals('OFFICIAL', $item['publisher_type']);
        }

        // 测试发布者类型筛选 - USER
        $userPublisherResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'publisher_type' => 'USER',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $userPublisherResponse['code']);
        $this->assertIsInt($userPublisherResponse['data']['total']);
        // 验证筛选结果中的 publisher_type 都是 USER（如果有结果）
        foreach ($userPublisherResponse['data']['list'] as $item) {
            $this->assertEquals('USER', $item['publisher_type']);
        }

        // 测试组合搜索（关键词 + 发布者类型）
        $combinedResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'keyword' => '搜索',
                'publisher_type' => 'OFFICIAL',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $combinedResponse['code']);
        $this->assertIsInt($combinedResponse['data']['total']);
        // 验证结果同时满足关键词和发布者类型条件
        foreach ($combinedResponse['data']['list'] as $item) {
            $this->assertEquals('OFFICIAL', $item['publisher_type']);
        }

        // 测试分页 - 第一页
        $pageResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 1,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $pageResponse['code']);
        $this->assertLessThanOrEqual(1, count($pageResponse['data']['list']));
        $this->assertEquals(1, $pageResponse['data']['page']);
        $this->assertEquals(1, $pageResponse['data']['page_size']);

        // 测试分页 - 第二页
        if ($pageResponse['data']['total'] > 1) {
            $page2Response = $this->post(
                '/api/v1/skill-market/queries',
                [
                    'page' => 2,
                    'page_size' => 1,
                ],
                $this->getCommonHeaders()
            );
            $this->assertEquals(1000, $page2Response['code']);
            $this->assertLessThanOrEqual(1, count($page2Response['data']['list']));
            $this->assertEquals(2, $page2Response['data']['page']);
            $this->assertEquals(1, $page2Response['data']['page_size']);
            // 验证不同页的数据不同（如果有数据）
            if (count($pageResponse['data']['list']) > 0 && count($page2Response['data']['list']) > 0) {
                $this->assertNotEquals(
                    $pageResponse['data']['list'][0]['id'],
                    $page2Response['data']['list'][0]['id'],
                    '不同页的数据应该不同'
                );
            }
        }

        // 测试最大分页大小
        $maxPageSizeResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 100,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $maxPageSizeResponse['code']);
        $this->assertLessThanOrEqual(100, count($maxPageSizeResponse['data']['list']));

        // 测试默认参数（不传 page 和 page_size）
        $defaultResponse = $this->post(
            '/api/v1/skill-market/queries',
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $defaultResponse['code']);
        $this->assertArrayHasKey('list', $defaultResponse['data']);
        $this->assertArrayHasKey('total', $defaultResponse['data']);
        $this->assertArrayHasKey('page', $defaultResponse['data']);
        $this->assertArrayHasKey('page_size', $defaultResponse['data']);

        // 测试排序：已添加的技能应该排在最前面
        $sortedResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $sortedResponse['code']);
        if (count($sortedResponse['data']['list']) > 1) {
            $hasAdded = false;
            $hasNotAdded = false;
            $firstNotAddedIndex = null;
            foreach ($sortedResponse['data']['list'] as $index => $item) {
                if ($item['is_added']) {
                    $hasAdded = true;
                    if ($firstNotAddedIndex !== null) {
                        // 如果之前已经有未添加的技能，那么已添加的技能不应该在后面
                        $this->fail('已添加的技能应该排在未添加的技能之前');
                    }
                } else {
                    $hasNotAdded = true;
                    if ($firstNotAddedIndex === null) {
                        $firstNotAddedIndex = $index;
                    }
                }
            }
            // 如果有已添加和未添加的技能，验证排序正确性
            if ($hasAdded && $hasNotAdded && $firstNotAddedIndex !== null) {
                // 验证第一个未添加的技能之前的所有技能都是已添加的
                for ($i = 0; $i < $firstNotAddedIndex; ++$i) {
                    $this->assertTrue($sortedResponse['data']['list'][$i]['is_added'], '已添加的技能应该排在最前面');
                }
            }
        }
    }

    public function testAdminSkillMarketCanUpdateIsHiddenAndPublicListExcludesHiddenItem(): void
    {
        $storeSkill = $this->createPublishedStoreSkillRecord();
        $headers = $this->getCommonHeaders();

        $adminQueryResponse = $this->post(
            '/api/v1/admin/skills/markets/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'skill_code' => $storeSkill['skill_code'],
            ],
            $headers
        );

        if (isset($adminQueryResponse['code']) && in_array($adminQueryResponse['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口需要管理员权限，跳过测试');
            return;
        }

        $this->assertEquals(1000, $adminQueryResponse['code'], $adminQueryResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $adminQueryResponse);
        $this->assertIsArray($adminQueryResponse['data']['list'] ?? null);
        $this->assertNotEmpty($adminQueryResponse['data']['list']);

        $marketItem = null;
        foreach ($adminQueryResponse['data']['list'] as $item) {
            if (($item['skill_code'] ?? null) === $storeSkill['skill_code']) {
                $marketItem = $item;
                break;
            }
        }

        $this->assertNotNull($marketItem, '应该能在管理后台市场列表中查到目标技能');
        $this->assertSame($storeSkill['package_name'], $marketItem['package_name'] ?? null);
        $this->assertArrayHasKey('is_hidden', $marketItem);
        $this->assertFalse($marketItem['is_hidden']);

        $adminUpdateResponse = $this->put(
            '/api/v1/admin/skills/markets/' . $storeSkill['store_skill_id'],
            ['is_hidden' => true],
            $headers
        );
        $this->assertEquals(1000, $adminUpdateResponse['code'], $adminUpdateResponse['message'] ?? '');

        $marketModel = SkillMarketModel::query()->find($storeSkill['store_skill_id']);
        $this->assertNotNull($marketModel);
        $this->assertTrue((bool) $marketModel->is_hidden);

        $adminQueryAfterUpdateResponse = $this->post(
            '/api/v1/admin/skills/markets/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'skill_code' => $storeSkill['skill_code'],
            ],
            $headers
        );
        $this->assertEquals(1000, $adminQueryAfterUpdateResponse['code'], $adminQueryAfterUpdateResponse['message'] ?? '');

        $updatedMarketItem = null;
        foreach ($adminQueryAfterUpdateResponse['data']['list'] as $item) {
            if (($item['skill_code'] ?? null) === $storeSkill['skill_code']) {
                $updatedMarketItem = $item;
                break;
            }
        }

        $this->assertNotNull($updatedMarketItem);
        $this->assertTrue($updatedMarketItem['is_hidden']);

        $publicQueryResponse = $this->post(
            '/api/v1/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'codes' => [$storeSkill['skill_code']],
            ],
            $headers
        );
        $this->assertEquals(1000, $publicQueryResponse['code'], $publicQueryResponse['message'] ?? '');
        $this->assertSame(0, $publicQueryResponse['data']['total']);
        $this->assertSame([], $publicQueryResponse['data']['list']);
    }

    public function testAdminSkillMarketQueriesCanSearchByPackageName(): void
    {
        $storeSkill = $this->createPublishedStoreSkillRecord();
        $headers = $this->getCommonHeaders();

        $response = $this->post(
            '/api/v1/admin/skills/markets/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'package_name' => substr($storeSkill['package_name'], -12),
            ],
            $headers
        );

        if (isset($response['code']) && in_array($response['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口需要管理员权限，跳过测试');
            return;
        }

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertIsArray($response['data']['list'] ?? null);

        $marketItem = null;
        foreach ($response['data']['list'] as $item) {
            if (($item['skill_code'] ?? null) === $storeSkill['skill_code']) {
                $marketItem = $item;
                break;
            }
        }

        $this->assertNotNull($marketItem, '应该能通过 package_name 模糊搜索到目标技能');
        $this->assertSame($storeSkill['package_name'], $marketItem['package_name'] ?? null);
    }

    /**
     * 测试沙箱用户技能列表查询接口.
     */
    public function testSandboxQueries(): void
    {
        $this->switchUserTest1();

        // 先导入一个技能作为测试数据
        $testFile = $this->testFile;

        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $fileKey = $this->uploadFileAndGetKey($testFile, $organizationCode);

        // 第一阶段：解析文件
        $parseRequestData = ['file_key' => $fileKey];
        $parseResponse = $this->json(
            self::BASE_URI . '/import/parse/file',
            $parseRequestData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $parseResponse['code']);
        $importToken = $parseResponse['data']['import_token'] ?? null;
        $this->assertNotNull($importToken);

        // 第二阶段：导入技能
        $importRequestData = [
            'import_token' => $importToken,
            'name_i18n' => [
                'zh_CN' => '测试沙箱技能查询',
                'en_US' => 'Test Sandbox Skill Query',
            ],
            'description_i18n' => [
                'zh_CN' => '用于测试沙箱查询的技能',
                'en_US' => 'Skill for testing sandbox queries',
            ],
            'logo' => '',
        ];
        $importResponse = $this->post(
            self::BASE_URI . '/import',
            $importRequestData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $importResponse['code']);
        $skillId = $importResponse['data']['id'] ?? null;
        $skillCode = $importResponse['data']['skill_code'] ?? null;
        $this->assertNotNull($skillId);
        $this->assertNotNull($skillCode);

        // 测试沙箱基本查询
        $queryData = [
            'page' => 1,
            'page_size' => 20,
        ];
        $response = $this->post(
            '/api/v1/open-api/sandbox/skills/queries',
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
            $this->assertIsString($item['id']);
            $this->assertArrayHasKey('code', $item);
            $this->assertArrayHasKey('name_i18n', $item);
            $this->assertArrayHasKey('description_i18n', $item);
            $this->assertArrayHasKey('logo', $item);
            $this->assertArrayHasKey('source_type', $item);
            $this->assertArrayHasKey('is_enabled', $item);
            $this->assertArrayHasKey('pinned_at', $item);
            $this->assertArrayHasKey('latest_published_at', $item);
            $this->assertArrayHasKey('updated_at', $item);
            $this->assertArrayHasKey('created_at', $item);
        }

        // 测试关键词搜索
        $keywordQueryData = [
            'page' => 1,
            'page_size' => 20,
            'keyword' => '沙箱',
        ];
        $keywordResponse = $this->post(
            '/api/v1/open-api/sandbox/skills/queries',
            $keywordQueryData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $keywordResponse['code']);
        $this->assertIsInt($keywordResponse['data']['total']);
    }

    /**
     * 测试沙箱市场技能库列表查询接口.
     */
    public function testSandboxSkillMarketQueries(): void
    {
        $this->switchUserTest1();

        // 测试基本查询
        $response = $this->post(
            '/api/v1/open-api/sandbox/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('list', $response['data']);
        $this->assertArrayHasKey('total', $response['data']);
        $this->assertArrayHasKey('page', $response['data']);
        $this->assertArrayHasKey('page_size', $response['data']);
        $this->assertIsInt($response['data']['total']);
        $this->assertIsArray($response['data']['list']);
        $this->assertIsInt($response['data']['page']);
        $this->assertIsInt($response['data']['page_size']);

        // 验证列表项结构
        if (count($response['data']['list']) > 0) {
            $item = $response['data']['list'][0];
            $this->assertArrayHasKey('id', $item);
            $this->assertArrayHasKey('code', $item);
            $this->assertArrayHasKey('name_i18n', $item);
            $this->assertArrayHasKey('description_i18n', $item);
            $this->assertArrayHasKey('logo', $item);
            $this->assertArrayHasKey('updated_at', $item);
            $this->assertArrayHasKey('created_at', $item);
        }

        // 测试关键词搜索
        $keywordResponse = $this->post(
            '/api/v1/open-api/sandbox/skill-market/queries',
            [
                'page' => 1,
                'page_size' => 20,
                'keyword' => '测试',
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $keywordResponse['code']);
        $this->assertIsInt($keywordResponse['data']['total']);
    }

    /**
     * 测试 Agent 第三方导入技能接口.
     */
    public function testImportSkillFromAgentThirdParty(): void
    {
        $this->switchUserTest1();

        // 准备测试文件路径
        $testFile = $this->testFile;

        // 测试文件上传导入（使用 file 方法上传文件）
        $response = $this->file(
            '/api/v1/open-api/sandbox/skills/import-from-agent',
            [
                'name' => 'skill_file', 'file' => $testFile,
            ],
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('id', $response['data']);
        $this->assertArrayHasKey('skill_code', $response['data']);
        $this->assertIsString($response['data']['id']);
        $this->assertIsString($response['data']['skill_code']);

        $skillId = $response['data']['id'];
        $skillCode = $response['data']['skill_code'];

        // 验证技能已创建：通过查询接口验证
        $queryResponse = $this->post(
            '/api/v1/open-api/sandbox/skills/queries',
            [
                'page' => 1,
                'page_size' => 20,
            ],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $queryResponse['code']);
        $this->assertGreaterThanOrEqual(1, $queryResponse['data']['total']);

        // 验证创建的技能在列表中
        $found = false;
        foreach ($queryResponse['data']['list'] as $item) {
            if ($item['code'] === $skillCode) {
                $found = true;
                // 验证技能来源类型为 AGENT_THIRD_PARTY_IMPORT
                $this->assertEquals('AGENT_THIRD_PARTY_IMPORT', $item['source_type']);
                break;
            }
        }
        $this->assertTrue($found, '导入的技能应该在列表中');

        // 测试更新场景：再次上传同名技能文件
        $updateResponse = $this->file(
            '/api/v1/open-api/sandbox/skills/import-from-agent',
            [
                'skill_file' => $testFile,
            ],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $updateResponse['code'], $updateResponse['message'] ?? '');
        $this->assertArrayHasKey('data', $updateResponse);
        $this->assertArrayHasKey('id', $updateResponse['data']);
        $this->assertArrayHasKey('skill_code', $updateResponse['data']);
        // 更新场景：skill_code 应该相同
        $this->assertEquals($skillCode, $updateResponse['data']['skill_code'], '更新场景下 skill_code 应该保持不变');
    }

    /**
     * 测试从商店添加技能.
     */
    public function testAddSkillFromStore(): void
    {
        $this->switchUserTest1();

        // 创建已发布的商店技能
        $storeSkillData = $this->createPublishedStoreSkill();
        $storeSkillId = $storeSkillData['store_skill_id'];

        SkillMarketModel::query()
            ->where('skill_version_id', $storeSkillId)
            ->delete();

        $this->switchUserTest2();

        // 测试添加技能
        $addData = [
            'store_skill_id' => (string) $storeSkillId,
        ];
        $response = $this->post(
            self::BASE_URI . '/from-store',
            $addData,
            $this->getCommonHeaders()
        );

        // 验证响应
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertEmpty($response['data'], '添加成功应返回空数组');

        // 验证技能已添加到用户技能库
        $headers = $this->getCommonHeaders();

        // 验证安装次数已增加
        $storeSkill = SkillMarketModel::query()
            ->where('id', $storeSkillId)
            ->first();
        $this->assertNotNull($storeSkill);
        $this->assertGreaterThanOrEqual(1, $storeSkill->install_count, '安装次数应该增加');
    }

    /**
     * 测试反复添加技能（应该返回错误）.
     */
    public function testAddSkillFromStoreDuplicate(): void
    {
        $this->switchUserTest1();

        // 创建已发布的商店技能
        $storeSkillData = $this->createPublishedStoreSkill();
        $storeSkillId = $storeSkillData['store_skill_id'];

        SkillMarketModel::query()
            ->where('skill_version_id', $storeSkillId)
            ->delete();

        $this->switchUserTest2();

        // 第一次添加技能
        $addData = [
            'store_skill_id' => (string) $storeSkillId,
        ];
        $firstResponse = $this->post(
            self::BASE_URI . '/from-store',
            $addData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $firstResponse['code'], '第一次添加应该成功');

        // 第二次添加相同技能（应该返回错误）
        $secondResponse = $this->post(
            self::BASE_URI . '/from-store',
            $addData,
            $this->getCommonHeaders()
        );
        $this->assertNotEquals(1000, $secondResponse['code'], '重复添加应该返回错误');
    }

    public function testSkillCreatorCannotAddSkillFromStore(): void
    {
        $this->switchUserTest1();

        $storeSkillData = $this->createPublishedStoreSkill();
        $storeSkillId = $storeSkillData['store_skill_id'];

        SkillMarketModel::query()
            ->where('skill_version_id', $storeSkillId)
            ->delete();

        $response = $this->post(
            self::BASE_URI . '/from-store',
            [
                'store_skill_id' => (string) $storeSkillId,
            ],
            $this->getCommonHeaders()
        );

        $this->assertNotEquals(1000, $response['code'], '技能创建者不应该能从市场添加自己的技能');
    }

    public function testGetSkillVersionList(): void
    {
        $this->switchUserTest1();

        $skillCode = $this->createTestSkill();

        $privatePublishResponse = $this->publishSkillVersion($skillCode, IdGenerator::getUniqueId32(), 'PRIVATE');
        $this->assertEquals(1000, $privatePublishResponse['code']);

        $marketPublishResponse = $this->publishSkillVersion($skillCode, IdGenerator::getUniqueId32(), 'MARKET');
        $this->assertEquals(1000, $marketPublishResponse['code']);

        $response = $this->get(
            self::BASE_URI . '/' . $skillCode . '/versions',
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('list', $response['data']);
        $this->assertArrayHasKey('page', $response['data']);
        $this->assertArrayHasKey('page_size', $response['data']);
        $this->assertArrayHasKey('total', $response['data']);
        $this->assertGreaterThanOrEqual(2, $response['data']['total']);

        $item = $response['data']['list'][0];
        $this->assertArrayHasKey('id', $item);
        $this->assertArrayHasKey('version', $item);
        $this->assertArrayHasKey('publish_status', $item);
        $this->assertArrayHasKey('review_status', $item);
        $this->assertArrayHasKey('publish_target_type', $item);
        $this->assertArrayHasKey('publisher', $item);
        $this->assertArrayHasKey('published_at', $item);
        $this->assertArrayHasKey('is_current_version', $item);
        $this->assertArrayHasKey('version_description_i18n', $item);
    }

    /**
     * 创建标准的测试 Skill Zip 文件，包含 SKILL.md 文件.
     */
    private function createTestSkillZip(?string $seed = null, string $skillMdZipPath = 'SKILL.md'): string
    {
        ++$this->testSkillZipSequence;
        $skillSeed = $seed ?? 'skill';
        $sanitizedSeed = trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $skillSeed), '-');
        $uniqueSuffix = strtolower($sanitizedSeed . '-' . $this->testSkillZipSequence . '-' . IdGenerator::getUniqueId32());

        // 创建临时目录
        $tempDir = sys_get_temp_dir() . '/skill_test_' . uniqid();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // 创建 SKILL.md 文件内容
        $skillMdContent = <<<MD
name: {$uniqueSuffix}
description: Test skill package {$uniqueSuffix}
MD;

        // 写入 SKILL.md 文件
        file_put_contents($tempDir . '/SKILL.md', $skillMdContent);

        // 创建 zip 文件
        $zipPath = sys_get_temp_dir() . '/test_skill_' . uniqid() . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('无法创建测试 zip 文件: ' . $zipPath);
        }

        // 添加 SKILL.md 文件到 zip
        $zip->addFile($tempDir . '/SKILL.md', $skillMdZipPath);
        $zip->close();

        // 清理临时目录
        unlink($tempDir . '/SKILL.md');
        rmdir($tempDir);

        $this->testFiles[] = $zipPath;

        return $zipPath;
    }

    /**
     * 创建测试技能并返回 skill_code.
     *
     * @return string skill_code
     */
    private function createTestSkill(): string
    {
        $testFile = $this->createTestSkillZip($this->name() . '-create-skill');

        $headers = $this->getCommonHeaders();

        $organizationCode = $headers['organization-code'];
        $fileKey = $this->uploadFileAndGetKey($testFile, $organizationCode);

        // 第一阶段：解析文件
        $parseRequestData = ['file_key' => $fileKey];
        $parseResponse = $this->json(
            self::BASE_URI . '/import/parse/file',
            $parseRequestData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $parseResponse['code']);
        $importToken = $parseResponse['data']['import_token'] ?? null;
        $this->assertNotNull($importToken);

        // 第二阶段：导入技能
        $importRequestData = [
            'import_token' => $importToken,
            'name_i18n' => [
                'zh_CN' => '测试技能',
                'en_US' => 'Test Skill',
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个测试技能',
                'en_US' => 'This is a test skill',
            ],
            'logo' => '',
        ];
        $importResponse = $this->post(
            self::BASE_URI . '/import',
            $importRequestData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $importResponse['code']);
        $skillCode = $importResponse['data']['skill_code'] ?? null;
        $this->assertNotNull($skillCode, 'skill_code 不应为空');

        $this->get(
            self::BASE_URI . '/' . $skillCode,
            $importRequestData,
            $this->getCommonHeaders()
        );

        return $skillCode;
    }

    /**
     * 上传文件并获取 file_key.
     *
     * @param string $filePath 本地文件路径
     * @param string $organizationCode 组织代码
     * @return string file_key
     */
    private function uploadFileAndGetKey(string $filePath, string $organizationCode): string
    {
        if (! file_exists($filePath)) {
            $this->markTestSkipped('测试文件不存在: ' . $filePath);
        }

        /** @var FileAppService $fileAppService */
        $fileAppService = \Hyperf\Support\make(FileAppService::class);

        // 生成临时文件 key
        $fileName = basename($filePath);
        $fileDir = 'temp/skills';
        $fileKey = $fileDir . '/' . IdGenerator::getUniqueId32() . '_' . $fileName;

        // 创建 UploadFile 对象并上传
        $uploadFile = new UploadFile($filePath, $fileDir, basename($fileKey), false);
        $fileAppService->upload($organizationCode, $uploadFile, StorageBucketType::Private, false);

        return $uploadFile->getKey();
    }

    /**
     * 根据ID获取技能版本信息.
     *
     * @param int|string $versionId 版本ID
     * @param string $organizationCode 组织代码
     * @return null|array 版本信息
     */
    private function getSkillVersionById(int|string $versionId, string $organizationCode): ?array
    {
        $version = SkillVersionModel::query()
            ->where('id', $versionId)
            ->where('organization_code', $organizationCode)
            ->first();

        return $version ? $version->toArray() : null;
    }

    /**
     * 创建已发布的商店技能（用于测试）.
     *
     * @return array{store_skill_id: int, skill_code: string, version_id: int} 返回商店技能ID、技能代码和版本ID
     */
    private function createPublishedStoreSkill(): array
    {
        $this->switchUserTest1();

        // 1. 创建技能
        $skillCode = $this->createTestSkill();

        // 2. 发布技能
        $publishResponse = $this->publishSkillVersion($skillCode, '1.0.0', 'MARKET');
        $this->assertEquals(1000, $publishResponse['code']);

        // 3. 获取版本ID并审核通过
        $versionId = $publishResponse['data']['version_id'];
        $this->assertNotNull($versionId, '应该创建了技能版本');

        // 4. 审核通过
        $approveData = [
            'action' => 'APPROVED',
            'publisher_type' => 'USER',
        ];
        $approveResponse = $this->put(
            '/api/v1/admin/skills/versions/' . $versionId . '/review',
            $approveData,
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $approveResponse['code']);

        // 5. 查询商店技能ID
        $storeSkill = SkillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->where('publish_status', 'PUBLISHED')
            ->first();
        $this->assertNotNull($storeSkill, '应该创建了商店技能');
        $storeSkillId = $storeSkill->id;

        return [
            'store_skill_id' => $storeSkillId,
            'skill_code' => $skillCode,
            'version_id' => $versionId,
        ];
    }

    /**
     * 直接创建已发布的市场技能记录，避免依赖发布链路中的无关逻辑.
     *
     * @return array{store_skill_id: int, skill_code: string, version_id: int, package_name: string}
     */
    private function createPublishedStoreSkillRecord(): array
    {
        $this->switchUserTest1();
        $headers = $this->getCommonHeaders();
        $organizationCode = $headers['organization-code'];
        $userId = $headers['user-id'];
        $skillCode = 'SKILL-' . IdGenerator::getUniqueId32();
        $skillId = IdGenerator::getSnowId();
        $versionId = IdGenerator::getSnowId();
        $publishedAt = date('Y-m-d H:i:s');
        $packageName = 'pkg-' . strtolower(IdGenerator::getUniqueId32());

        SkillModel::query()->create([
            'id' => $skillId,
            'organization_code' => $organizationCode,
            'code' => $skillCode,
            'creator_id' => $userId,
            'package_name' => $packageName,
            'package_description' => 'Published test skill package',
            'name_i18n' => [
                'zh_CN' => '市场技能',
                'en_US' => 'Market Skill',
            ],
            'description_i18n' => [
                'zh_CN' => '市场技能描述',
                'en_US' => 'Market skill description',
            ],
            'search_text' => 'market skill description',
            'logo' => '',
            'file_key' => 'temp/skills/' . strtolower(IdGenerator::getUniqueId32()) . '.zip',
            'source_type' => 'LOCAL_UPLOAD',
            'version_id' => $versionId,
            'version_code' => '1.0.0',
            'is_enabled' => true,
            'latest_published_at' => $publishedAt,
            'created_at' => $publishedAt,
            'updated_at' => $publishedAt,
        ]);

        SkillVersionModel::query()->create([
            'id' => $versionId,
            'code' => $skillCode,
            'organization_code' => $organizationCode,
            'creator_id' => $userId,
            'package_name' => $packageName,
            'package_description' => 'Published test skill package',
            'version' => '1.0.0',
            'name_i18n' => [
                'zh_CN' => '市场技能',
                'en_US' => 'Market Skill',
            ],
            'description_i18n' => [
                'zh_CN' => '市场技能描述',
                'en_US' => 'Market skill description',
            ],
            'search_text' => 'market skill description',
            'logo' => '',
            'file_key' => 'temp/skills/' . strtolower(IdGenerator::getUniqueId32()) . '.zip',
            'skill_file_key' => 'temp/skills/' . strtolower(IdGenerator::getUniqueId32()) . '/SKILL.md',
            'publish_status' => 'PUBLISHED',
            'review_status' => 'APPROVED',
            'publish_target_type' => 'MARKET',
            'version_description_i18n' => [
                'zh_CN' => '市场版本说明',
                'en_US' => 'Market version description',
            ],
            'publisher_user_id' => $userId,
            'published_at' => $publishedAt,
            'is_current_version' => true,
            'source_type' => 'LOCAL_UPLOAD',
            'created_at' => $publishedAt,
            'updated_at' => $publishedAt,
        ]);

        $storeSkillId = IdGenerator::getSnowId();
        SkillMarketModel::query()->create([
            'id' => $storeSkillId,
            'organization_code' => $organizationCode,
            'skill_code' => $skillCode,
            'skill_version_id' => $versionId,
            'name_i18n' => [
                'zh_CN' => '市场技能',
                'en_US' => 'Market Skill',
            ],
            'description_i18n' => [
                'zh_CN' => '市场技能描述',
                'en_US' => 'Market skill description',
            ],
            'search_text' => 'market skill description',
            'logo' => '',
            'publisher_id' => $userId,
            'publisher_type' => 'USER',
            'publish_status' => 'PUBLISHED',
            'created_at' => $publishedAt,
            'updated_at' => $publishedAt,
        ]);

        return [
            'store_skill_id' => $storeSkillId,
            'skill_code' => $skillCode,
            'version_id' => $versionId,
            'package_name' => $packageName,
        ];
    }

    private function publishSkillVersion(
        string $skillCode,
        string $version,
        string $publishTargetType,
        ?array $versionDescriptionI18n = null,
        ?array $publishTargetValue = null
    ): array {
        $requestData = [
            'version' => $version,
            'version_description_i18n' => $versionDescriptionI18n ?? [
                'zh_CN' => '测试版本说明',
                'en_US' => 'Test version description',
            ],
            'publish_target_type' => $publishTargetType,
            'publish_target_value' => $publishTargetValue,
        ];

        return $this->post(
            self::BASE_URI . '/' . $skillCode . '/publish',
            $requestData,
            $this->getCommonHeaders()
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getSkillVisibilityRows(string $organizationCode, string $skillCode): array
    {
        return Db::table('magic_resource_visibility')
            ->where('organization_code', $organizationCode)
            ->where('resource_type', 2)
            ->where('resource_code', $skillCode)
            ->orderBy('principal_type')
            ->orderBy('principal_id')
            ->get()
            ->map(static fn ($row) => (array) $row)
            ->toArray();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getUserSkillRows(string $organizationCode, string $skillCode): array
    {
        return Db::table('magic_user_skills')
            ->where('organization_code', $organizationCode)
            ->where('skill_code', $skillCode)
            ->whereNull('deleted_at')
            ->orderBy('user_id')
            ->get()
            ->map(static fn ($row) => (array) $row)
            ->toArray();
    }
}
