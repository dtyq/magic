<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\SuperAgent;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;

/**
 * @internal
 * Transfer ownership API test
 */
class TransferApiTest extends AbstractApiTest
{
    private const string PROJECTS_BASE_URI = '/api/v1/super-agent/projects';

    private const string WORKSPACES_BASE_URI = '/api/v1/super-agent/workspaces';

    private const string TRANSFER_PROJECTS_URI = '/api/v1/super-agent/projects/transfer';

    private const string TRANSFER_WORKSPACES_URI = '/api/v1/super-agent/workspaces/transfer';

    // Test user IDs - should match your test environment
    private string $testUserId1 = 'usi_516c3a162c868e6f02de247a10e59d05'; // Test user 1 (owner)

    private string $testUserId2 = 'usi_753aef2eb5e4c059f55149abf1289d63'; // Test user 2 (receiver)

    private array $testProjectIds = [];

    private array $testWorkspaceIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        // Default to test user 1, but can be switched during test
        $this->switchUserTest1();
    }

    protected function tearDown(): void
    {
        // Clean up test data if needed
        parent::tearDown();
    }

    /**
     * Test single project transfer without sharing.
     */
    public function testTransferSingleProjectWithoutSharing(): void
    {
        // 1. Create a test project
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        // 2. Verify project ownership before transfer
        $this->verifyProjectOwnership($projectId, $this->testUserId1);

        // 3. Transfer project to test user 2
        $requestData = [
            'project_ids' => [(string) $projectId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 4. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('ok', $response['message']);
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('results', $response['data']);
        $this->assertCount(1, $response['data']['results']);

        $result = $response['data']['results'][0];
        $this->assertEquals('success', $result['status']);
        $this->assertEquals((string) $projectId, $result['resource_id']);
        $this->assertArrayHasKey('files_count', $result);

        // 5. Verify project ownership after transfer
        $this->verifyProjectOwnership($projectId, $this->testUserId2);

        // 6. Verify original owner is not a member (since share_to_me = false)
        // Since the project has been transferred, the original owner should no longer have access
        // We verify this by attempting to access the project as the original owner - it should fail
        $this->switchUserTest1();
        $response = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId}/members",
            [],
            $this->getCommonHeaders()
        );

        // Original owner should not have access after transfer (error code 51202 = PROJECT_ACCESS_DENIED)
        $this->assertEquals(51202, $response['code'], 'Original owner should not have access after transfer without sharing');
    }

    /**
     * Test single project transfer with sharing.
     */
    public function testTransferSingleProjectWithSharing(): void
    {
        // 1. Create a test project
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        // 2. Transfer project to test user 2 with sharing
        $requestData = [
            'project_ids' => [(string) $projectId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => true,
            'share_role' => 'manage',
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 3. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('success', $response['data']['results'][0]['status']);

        // 4. Verify original owner is now a member with manage role
        $this->switchUserTest1();
        $this->verifyUserIsProjectMember($projectId, $this->testUserId1, 'manage');
    }

    /**
     * Test single project transfer with sharing (viewer) keeps original owner access.
     */
    public function testTransferSingleProjectWithSharingViewer(): void
    {
        // 1. Create a test project
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        // 2. Transfer project to test user 2 with sharing (viewer)
        $requestData = [
            'project_ids' => [(string) $projectId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => true,
            'share_role' => 'viewer',
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 3. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('success', $response['data']['results'][0]['status']);

        // 4. Verify project ownership after transfer
        $this->verifyProjectOwnership($projectId, $this->testUserId2);

        // 5. Original owner should retain view access (viewer role) to the project
        $this->switchUserTest1();
        $response = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId}",
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response['code'], 'Original owner should retain view access after sharing');
        $this->assertEquals($this->testUserId2, $response['data']['user_id']);
    }

    /**
     * Test batch project transfer.
     */
    public function testTransferBatchProjects(): void
    {
        // 1. Create multiple test projects
        $projectId1 = $this->createTestProject();
        $projectId2 = $this->createTestProject();
        $this->testProjectIds[] = $projectId1;
        $this->testProjectIds[] = $projectId2;

        // 2. Transfer multiple projects
        $requestData = [
            'project_ids' => [(string) $projectId1, (string) $projectId2],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 3. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertCount(2, $response['data']['results']);
        $this->assertEquals(2, $response['data']['success_count']);

        foreach ($response['data']['results'] as $result) {
            $this->assertEquals('success', $result['status']);
            $this->assertArrayHasKey('resource_id', $result);
            $this->assertArrayHasKey('files_count', $result);
        }

        // 4. Verify both projects ownership
        $this->verifyProjectOwnership($projectId1, $this->testUserId2);
        $this->verifyProjectOwnership($projectId2, $this->testUserId2);
    }

    /**
     * Test workspace transfer without projects.
     */
    public function testTransferWorkspaceWithoutProjects(): void
    {
        // 1. Create empty workspace
        $workspaceId = $this->createTestWorkspace();
        $this->testWorkspaceIds[] = $workspaceId;

        // 2. Verify workspace ownership before transfer
        $this->verifyWorkspaceOwnership($workspaceId, $this->testUserId1);

        // 3. Transfer workspace to test user 2 (no share)
        $requestData = [
            'workspace_ids' => [(string) $workspaceId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::WORKSPACES_BASE_URI . '/transfer',
            $requestData,
            $this->getCommonHeaders()
        );

        // 4. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('success', $response['data']['results'][0]['status']);

        // 5. Verify workspace ownership after transfer
        $this->verifyWorkspaceOwnership($workspaceId, $this->testUserId2);
    }

    /**
     * Test workspace transfer with projects without sharing back.
     */
    public function testTransferWorkspaceWithProjectsWithoutSharing(): void
    {
        // 1. Create workspace with projects
        $workspaceId = $this->createTestWorkspace();
        $projectId1 = $this->createTestProject($workspaceId);
        $projectId2 = $this->createTestProject($workspaceId);
        $this->testWorkspaceIds[] = $workspaceId;
        $this->testProjectIds[] = $projectId1;
        $this->testProjectIds[] = $projectId2;

        // 2. Transfer workspace to test user 2 without sharing
        $requestData = [
            'workspace_ids' => [(string) $workspaceId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::WORKSPACES_BASE_URI . '/transfer',
            $requestData,
            $this->getCommonHeaders()
        );

        // 3. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('success', $response['data']['results'][0]['status']);

        // 4. Verify ownership updates
        $this->verifyWorkspaceOwnership($workspaceId, $this->testUserId2);
        $this->verifyProjectOwnership($projectId1, $this->testUserId2);
        $this->verifyProjectOwnership($projectId2, $this->testUserId2);

        // 5. Original owner should lose access to projects
        $this->switchUserTest1();
        $response = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId1}/members",
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(51202, $response['code'], 'Original owner should not access project members after workspace transfer without sharing');
    }

    /**
     * Test workspace transfer with projects and sharing back (viewer).
     */
    public function testTransferWorkspaceWithProjectsWithSharing(): void
    {
        // 1. Create workspace with projects
        $workspaceId = $this->createTestWorkspace();
        $projectId1 = $this->createTestProject($workspaceId);
        $projectId2 = $this->createTestProject($workspaceId);
        $this->testWorkspaceIds[] = $workspaceId;
        $this->testProjectIds[] = $projectId1;
        $this->testProjectIds[] = $projectId2;

        // 2. Transfer workspace to test user 2 with sharing (viewer)
        $requestData = [
            'workspace_ids' => [(string) $workspaceId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => true,
            'share_role' => 'viewer',
        ];

        $response = $this->post(
            self::WORKSPACES_BASE_URI . '/transfer',
            $requestData,
            $this->getCommonHeaders()
        );

        // 3. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('success', $response['data']['results'][0]['status']);

        // 4. Verify ownership updates
        $this->verifyWorkspaceOwnership($workspaceId, $this->testUserId2);
        $this->verifyProjectOwnership($projectId1, $this->testUserId2);
        $this->verifyProjectOwnership($projectId2, $this->testUserId2);

        // 5. Original owner should be able to view projects (viewer role)
        $this->switchUserTest1();
        $response1 = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId1}",
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response1['code'], 'Original owner should retain view access (proj1)');
        $this->assertEquals('viewer', $response1['data']['user_role']);

        $response2 = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId2}",
            [],
            $this->getCommonHeaders()
        );
        $this->assertEquals(1000, $response2['code'], 'Original owner should retain view access (proj2)');
        $this->assertEquals('viewer', $response2['data']['user_role']);
    }

    /**
     * Test workspace transfer without sharing.
     */
    public function testTransferWorkspaceWithoutSharing(): void
    {
        // 1. Create a test workspace with projects
        $workspaceId = $this->createTestWorkspace();
        $projectId1 = $this->createTestProject($workspaceId);
        $projectId2 = $this->createTestProject($workspaceId);
        $this->testWorkspaceIds[] = $workspaceId;
        $this->testProjectIds[] = $projectId1;
        $this->testProjectIds[] = $projectId2;

        // 2. Verify workspace ownership before transfer
        $this->verifyWorkspaceOwnership($workspaceId, $this->testUserId1);

        // 3. Transfer workspace to test user 2
        $requestData = [
            'workspace_ids' => [(string) $workspaceId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_WORKSPACES_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 4. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('ok', $response['message']);
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('results', $response['data']);
        $this->assertCount(1, $response['data']['results']);

        $result = $response['data']['results'][0];
        $this->assertEquals('success', $result['status']);
        $this->assertEquals((string) $workspaceId, $result['resource_id']);
        $this->assertGreaterThanOrEqual(2, $result['projects_count']);
        $this->assertArrayHasKey('files_count', $result);

        // 5. Verify workspace ownership after transfer
        $this->verifyWorkspaceOwnership($workspaceId, $this->testUserId2);

        // 6. Verify all projects in workspace are transferred
        $this->verifyProjectOwnership($projectId1, $this->testUserId2);
        $this->verifyProjectOwnership($projectId2, $this->testUserId2);
    }

    /**
     * Test workspace transfer with sharing.
     */
    public function testTransferWorkspaceWithSharing(): void
    {
        // 1. Create a test workspace
        $workspaceId = $this->createTestWorkspace();
        $this->testWorkspaceIds[] = $workspaceId;

        // 2. Transfer workspace with sharing
        $requestData = [
            'workspace_ids' => [(string) $workspaceId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => true,
            'share_role' => 'editor',
        ];

        $response = $this->post(
            self::TRANSFER_WORKSPACES_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // 3. Verify transfer success
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('success', $response['data']['results'][0]['status']);

        // 4. Verify original owner is now a member with editor role
        // Note: Workspace members are managed through projects, so we verify at project level
        // This depends on your implementation details
    }

    /**
     * Test transfer to self (should fail).
     */
    public function testTransferToSelf(): void
    {
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        $requestData = [
            'project_ids' => [(string) $projectId],
            'receiver_id' => $this->testUserId1, // Transfer to self
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // Should return error code for cannot transfer to self
        $this->assertNotEquals(1000, $response['code']);
        $this->assertEquals(51280, $response['code']); // CANNOT_TRANSFER_TO_SELF
    }

    /**
     * Test transfer non-existent project (should fail).
     */
    public function testTransferNonExistentProject(): void
    {
        $requestData = [
            'project_ids' => ['999999999999999999'], // Non-existent project ID
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // Should return error code for resource not found
        $this->assertNotEquals(1000, $response['code']);
        $this->assertEquals(51284, $response['code']); // TRANSFER_RESOURCE_NOT_FOUND
    }

    /**
     * Test transfer project without permission (should fail).
     */
    public function testTransferProjectWithoutPermission(): void
    {
        // 1. Create project with test user 1
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        // 2. Switch to test user 2 (not the owner)
        $this->switchUserTest2();

        // 3. Try to transfer project (should fail - no permission)
        $requestData = [
            'project_ids' => [(string) $projectId],
            'receiver_id' => $this->testUserId1,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // Should return error code for no permission
        $this->assertNotEquals(1000, $response['code']);
        $this->assertEquals(51283, $response['code']); // NO_PERMISSION_TO_TRANSFER
    }

    /**
     * Test validation errors - empty project_ids.
     */
    public function testValidationEmptyProjectIds(): void
    {
        $requestData = [
            'project_ids' => [],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // Should return validation error
        $this->assertNotEquals(1000, $response['code']);
    }

    /**
     * Test validation errors - missing receiver_id.
     */
    public function testValidationMissingReceiverId(): void
    {
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        $requestData = [
            'project_ids' => [(string) $projectId],
            'share_to_me' => false,
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // Should return validation error
        $this->assertNotEquals(1000, $response['code']);
    }

    /**
     * Test validation errors - invalid share_role.
     */
    public function testValidationInvalidShareRole(): void
    {
        $projectId = $this->createTestProject();
        $this->testProjectIds[] = $projectId;

        $requestData = [
            'project_ids' => [(string) $projectId],
            'receiver_id' => $this->testUserId2,
            'share_to_me' => true,
            'share_role' => 'invalid_role', // Invalid role
        ];

        $response = $this->post(
            self::TRANSFER_PROJECTS_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        // Should return validation error
        $this->assertNotEquals(1000, $response['code']);
    }

    // ========== Helper Methods ==========

    /**
     * Create a test project.
     */
    private function createTestProject(?string $workspaceId = null): int
    {
        if ($workspaceId === null) {
            $workspaceId = $this->createTestWorkspace();
        }

        $requestData = [
            'project_name' => 'Test Project ' . time(),
            'project_description' => 'Test project for transfer',
            'workspace_id' => $workspaceId,
        ];

        $response = $this->post(
            self::PROJECTS_BASE_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], 'Failed to create test project: ' . ($response['message'] ?? ''));
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('project', $response['data']);

        return (int) $response['data']['project']['id'];
    }

    /**
     * Create a test workspace.
     */
    private function createTestWorkspace(): string
    {
        $requestData = [
            'workspace_name' => 'Test Workspace ' . time(),
        ];

        $response = $this->post(
            self::WORKSPACES_BASE_URI,
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], 'Failed to create test workspace: ' . ($response['message'] ?? ''));
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('id', $response['data']);

        return $response['data']['id'];
    }

    /**
     * Verify project ownership.
     */
    private function verifyProjectOwnership(int $projectId, string $expectedUserId): void
    {
        $projectRepository = di()->get(ProjectRepositoryInterface::class);
        $project = $projectRepository->findById($projectId);

        $this->assertNotNull($project, "Project {$projectId} should exist");
        $this->assertEquals($expectedUserId, $project->getUserId(), "Project {$projectId} should be owned by {$expectedUserId}");
    }

    /**
     * Verify workspace ownership.
     */
    private function verifyWorkspaceOwnership(string $workspaceId, string $expectedUserId): void
    {
        $workspaceRepository = di()->get(WorkspaceRepositoryInterface::class);
        $workspace = $workspaceRepository->findById((int) $workspaceId);

        $this->assertNotNull($workspace, "Workspace {$workspaceId} should exist");
        $this->assertEquals($expectedUserId, $workspace->getUserId(), "Workspace {$workspaceId} should be owned by {$expectedUserId}");
    }

    /**
     * Verify user is a project member with specific role.
     */
    private function verifyUserIsProjectMember(int $projectId, string $userId, string $expectedRole): void
    {
        $response = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId}/members",
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('members', $response['data']);

        $found = false;
        foreach ($response['data']['members'] as $member) {
            if (isset($member['user_id']) && $member['user_id'] === $userId) {
                $found = true;
                $this->assertEquals($expectedRole, $member['role'], "User {$userId} should have role {$expectedRole}");
                break;
            }
        }

        $this->assertTrue($found, "User {$userId} should be a member of project {$projectId}");
    }

    /**
     * Verify user is not a project member.
     */
    private function verifyUserNotProjectMember(int $projectId, string $userId): void
    {
        $response = $this->get(
            self::PROJECTS_BASE_URI . "/{$projectId}/members",
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('members', $response['data']);

        $found = false;
        foreach ($response['data']['members'] as $member) {
            if (isset($member['user_id']) && $member['user_id'] === $userId) {
                $found = true;
                break;
            }
        }

        $this->assertFalse($found, "User {$userId} should not be a member of project {$projectId}");
    }
}
