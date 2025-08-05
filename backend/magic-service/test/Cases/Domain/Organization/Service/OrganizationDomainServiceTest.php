<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Organization\Service;

use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Persistence\Model\OrganizationModel;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Exception;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class OrganizationDomainServiceTest extends HttpTestCase
{
    private OrganizationDomainService $organizationDomainService;

    private array $testOrganizationCodes = [];

    private array $testOrganizationIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->organizationDomainService = $this->getContainer()->get(OrganizationDomainService::class);

        // 为每个测试生成唯一的组织编码，避免测试之间的数据冲突
        $this->testOrganizationCodes = [
            'TEST_ORG_' . uniqid(),
            'TEST_ORG_' . uniqid(),
            'TEST_ORG_' . uniqid(),
        ];

        // 清理可能存在的测试数据
        $this->cleanUpTestData();
    }

    protected function tearDown(): void
    {
        // 清理测试数据
        $this->cleanUpTestData();

        parent::tearDown();
    }

    public function testCreateOrganizationSuccessfully(): void
    {
        $organization = $this->createTestOrganizationEntity(0);

        $savedOrganization = $this->organizationDomainService->create($organization);

        $this->assertNotNull($savedOrganization->getId());
        $this->assertEquals($this->testOrganizationCodes[0], $savedOrganization->getMagicOrganizationCode());
        $this->assertEquals('Test Organization 0', $savedOrganization->getName());
        $this->assertEquals('Technology', $savedOrganization->getIndustryType());
        $this->assertEquals(1, $savedOrganization->getStatus());
        $this->assertNotNull($savedOrganization->getCreatedAt());

        // 记录 ID 用于清理
        $this->testOrganizationIds[] = $savedOrganization->getId();
    }

    public function testCreateOrganizationWithDuplicateCodeThrowsException(): void
    {
        // 创建第一个组织
        $organization1 = $this->createTestOrganizationEntity(0);
        $savedOrganization1 = $this->organizationDomainService->create($organization1);
        $this->testOrganizationIds[] = $savedOrganization1->getId();

        // 尝试创建具有相同编码的组织
        $organization2 = $this->createTestOrganizationEntity(0); // 使用相同的编码

        $this->expectException(Exception::class);
        $this->organizationDomainService->create($organization2);
    }

    public function testCreateOrganizationWithDuplicateNameThrowsException(): void
    {
        // 创建第一个组织
        $organization1 = $this->createTestOrganizationEntity(0);
        $savedOrganization1 = $this->organizationDomainService->create($organization1);
        $this->testOrganizationIds[] = $savedOrganization1->getId();

        // 尝试创建具有相同名称的组织
        $organization2 = $this->createTestOrganizationEntity(1);
        $organization2->setName('Test Organization 0'); // 使用相同的名称

        $this->expectException(Exception::class);
        $this->organizationDomainService->create($organization2);
    }

    public function testCreateOrganizationWithMissingRequiredFieldsThrowsException(): void
    {
        $organization = new OrganizationEntity();
        // 不设置必填字段

        $this->expectException(Exception::class);
        $this->organizationDomainService->create($organization);
    }

    public function testUpdateOrganizationSuccessfully(): void
    {
        // 创建组织
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        // 更新组织
        $savedOrganization->setName('Updated Organization Name');
        $savedOrganization->setContactUser('Updated Contact');

        $updatedOrganization = $this->organizationDomainService->update($savedOrganization);

        $this->assertEquals('Updated Organization Name', $updatedOrganization->getName());
        $this->assertEquals('Updated Contact', $updatedOrganization->getContactUser());
        $this->assertNotNull($updatedOrganization->getUpdatedAt());
    }

    public function testUpdateNonExistentOrganizationThrowsException(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        // 不设置 ID，使其认为是新实体

        $this->expectException(Exception::class);
        $this->organizationDomainService->update($organization);
    }

    public function testGetByIdReturnsCorrectOrganization(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        $foundOrganization = $this->organizationDomainService->getById($savedOrganization->getId());

        $this->assertNotNull($foundOrganization);
        $this->assertEquals($savedOrganization->getId(), $foundOrganization->getId());
        $this->assertEquals($savedOrganization->getMagicOrganizationCode(), $foundOrganization->getMagicOrganizationCode());
        $this->assertEquals($savedOrganization->getName(), $foundOrganization->getName());
    }

    public function testGetByIdWithNonExistentIdReturnsNull(): void
    {
        $foundOrganization = $this->organizationDomainService->getById(999999);

        $this->assertNull($foundOrganization);
    }

    public function testGetByCodeReturnsCorrectOrganization(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        $foundOrganization = $this->organizationDomainService->getByCode($this->testOrganizationCodes[0]);

        $this->assertNotNull($foundOrganization);
        $this->assertEquals($savedOrganization->getId(), $foundOrganization->getId());
        $this->assertEquals($this->testOrganizationCodes[0], $foundOrganization->getMagicOrganizationCode());
    }

    public function testGetByNameReturnsCorrectOrganization(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        $foundOrganization = $this->organizationDomainService->getByName('Test Organization 0');

        $this->assertNotNull($foundOrganization);
        $this->assertEquals($savedOrganization->getId(), $foundOrganization->getId());
        $this->assertEquals('Test Organization 0', $foundOrganization->getName());
    }

    public function testQueriesReturnsCorrectResults(): void
    {
        // 创建多个组织
        for ($i = 0; $i < 3; ++$i) {
            $organization = $this->createTestOrganizationEntity($i);
            $savedOrganization = $this->organizationDomainService->create($organization);
            $this->testOrganizationIds[] = $savedOrganization->getId();
        }

        $page = new Page(1, 10);
        $result = $this->organizationDomainService->queries($page);

        $this->assertArrayHasKey('total', $result);
        $this->assertArrayHasKey('list', $result);
        $this->assertGreaterThanOrEqual(3, $result['total']);
        $this->assertIsArray($result['list']);
    }

    public function testQueriesWithFilters(): void
    {
        // 创建组织
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        $page = new Page(1, 10);
        $filters = [
            'name' => 'Test Organization',
            'status' => 1,
            'industry_type' => 'Technology',
        ];
        $result = $this->organizationDomainService->queries($page, $filters);

        $this->assertArrayHasKey('total', $result);
        $this->assertArrayHasKey('list', $result);
        $this->assertGreaterThanOrEqual(1, $result['total']);

        // 验证过滤结果
        foreach ($result['list'] as $org) {
            $this->assertInstanceOf(OrganizationEntity::class, $org);
            $this->assertStringContainsString('Test Organization', $org->getName());
            $this->assertEquals(1, $org->getStatus());
            $this->assertEquals('Technology', $org->getIndustryType());
        }
    }

    public function testDeleteOrganizationSuccessfully(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $orgId = $savedOrganization->getId();

        $this->organizationDomainService->delete($orgId);

        $foundOrganization = $this->organizationDomainService->getById($orgId);
        $this->assertNull($foundOrganization);
    }

    public function testDeleteNonExistentOrganizationThrowsException(): void
    {
        $this->expectException(Exception::class);
        $this->organizationDomainService->delete(999999);
    }

    public function testEnableOrganization(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        $organization->setStatus(2); // 设置为禁用状态
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        $enabledOrganization = $this->organizationDomainService->enable($savedOrganization->getId());

        $this->assertEquals(1, $enabledOrganization->getStatus());
        $this->assertTrue($enabledOrganization->isNormal());
    }

    public function testDisableOrganization(): void
    {
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        $disabledOrganization = $this->organizationDomainService->disable($savedOrganization->getId());

        $this->assertEquals(2, $disabledOrganization->getStatus());
        $this->assertFalse($disabledOrganization->isNormal());
    }

    public function testIsCodeAvailable(): void
    {
        // 测试不存在的编码
        $isAvailable = $this->organizationDomainService->isCodeAvailable('NON_EXISTENT_CODE');
        $this->assertTrue($isAvailable);

        // 创建组织
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        // 测试已存在的编码
        $isAvailable = $this->organizationDomainService->isCodeAvailable($this->testOrganizationCodes[0]);
        $this->assertFalse($isAvailable);

        // 测试排除当前组织的情况
        $isAvailable = $this->organizationDomainService->isCodeAvailable(
            $this->testOrganizationCodes[0],
            $savedOrganization->getId()
        );
        $this->assertTrue($isAvailable);
    }

    public function testIsNameAvailable(): void
    {
        // 测试不存在的名称
        $isAvailable = $this->organizationDomainService->isNameAvailable('Non Existent Organization');
        $this->assertTrue($isAvailable);

        // 创建组织
        $organization = $this->createTestOrganizationEntity(0);
        $savedOrganization = $this->organizationDomainService->create($organization);
        $this->testOrganizationIds[] = $savedOrganization->getId();

        // 测试已存在的名称
        $isAvailable = $this->organizationDomainService->isNameAvailable('Test Organization 0');
        $this->assertFalse($isAvailable);

        // 测试排除当前组织的情况
        $isAvailable = $this->organizationDomainService->isNameAvailable(
            'Test Organization 0',
            $savedOrganization->getId()
        );
        $this->assertTrue($isAvailable);
    }

    /**
     * 创建测试用的组织实体.
     */
    private function createTestOrganizationEntity(int $index): OrganizationEntity
    {
        $organization = new OrganizationEntity();
        $organization->setMagicOrganizationCode($this->testOrganizationCodes[$index]);
        $organization->setName("Test Organization {$index}");
        $organization->setIndustryType('Technology');
        $organization->setContactUser("Contact User {$index}");
        $organization->setContactMobile('13800138000');
        $organization->setCreatorId(1);
        $organization->setStatus(1);
        $organization->setType(0);

        return $organization;
    }

    /**
     * 清理测试数据.
     */
    private function cleanUpTestData(): void
    {
        try {
            // 删除通过 ID 记录的组织
            foreach ($this->testOrganizationIds as $id) {
                OrganizationModel::query()->where('id', $id)->forceDelete();
            }

            // 删除通过编码记录的组织
            foreach ($this->testOrganizationCodes as $code) {
                OrganizationModel::query()->where('code', $code)->forceDelete();
            }

            // 删除可能残留的测试数据
            OrganizationModel::query()
                ->where('code', 'like', 'TEST_ORG_%')
                ->orWhere('name', 'like', 'Test Organization%')
                ->orWhere('name', 'like', 'Updated Organization%')
                ->forceDelete();
        } catch (Exception $e) {
            // 静默处理清理错误
        }

        // 重置 ID 数组
        $this->testOrganizationIds = [];
    }
}
