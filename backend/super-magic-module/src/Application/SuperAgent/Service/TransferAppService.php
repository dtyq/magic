<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use DateTimeImmutable;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectOperationLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TransferLogEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferOptions;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectTransferredEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectOperationLogDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TransferDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TransferLogDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TransferProjectsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TransferWorkspacesRequestDTO;
use Hyperf\DbConnection\Db;
use Psr\EventDispatcher\EventDispatcherInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Transfer Application Service.
 *
 * Responsibilities:
 * - Coordinate multiple domain services to complete transfer
 * - Manage transaction boundaries
 * - Dispatch domain events after successful transfer
 * - Handle audit logging outside transaction
 */
class TransferAppService extends AbstractAppService
{
    public function __construct(
        private readonly TransferDomainService $transferDomainService,
        private readonly TransferLogDomainService $transferLogDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly ProjectOperationLogDomainService $operationLogDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly WorkspaceRepositoryInterface $workspaceRepository,
        private readonly PackageFilterInterface $packageFilterService,
    ) {
    }

    /**
     * Transfer projects to another user.
     */
    public function transferProjects(
        RequestContext $requestContext,
        TransferProjectsRequestDTO $requestDTO
    ): array {
        $fromUserId = $requestContext->getUserAuthorization()->getId();
        $organizationCode = $requestContext->getUserAuthorization()->getOrganizationCode();
        $toUserId = $requestDTO->getReceiverId();
        $shareToMe = $requestDTO->isShareToMe();
        // Only use share_role when share_to_me is true, otherwise ignore it completely
        $shareRole = $shareToMe ? $requestDTO->getShareRole() : '';
        // Only use retain_original_location when share_to_me is true
        $retainOriginalLocation = $shareToMe ? $requestDTO->getRetainOriginalLocation() : false;
        $fromUserName = $this->getUserDisplayName($fromUserId, $requestContext);

        if (! $this->packageFilterService->canTransferProject($organizationCode)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::NO_PERMISSION_TO_TRANSFER);
        }

        // 1. Validate receiver
        $this->validateReceiver($fromUserId, $toUserId, $organizationCode);

        // 2. Generate batch ID
        $batchId = $this->transferDomainService->generateBatchId();

        // 3. Process each project
        $results = [];
        foreach ($requestDTO->getProjectIds() as $projectId) {
            $result = $this->transferSingleProject(
                (int) $projectId,
                $fromUserId,
                $toUserId,
                $organizationCode,
                $batchId,
                $shareToMe,
                $shareRole,
                $fromUserName,
                $retainOriginalLocation
            );
            $results[] = $result;
        }

        $response = $this->buildBatchResponse($batchId, $results);

        // If all transfers failed, throw exception for frontend error handling
        if ($response['failed_count'] === $response['total'] && $response['total'] > 0) {
            $firstError = $results[0]['error'] ?? trans('transfer.transfer_failed');
            ExceptionBuilder::throw(SuperAgentErrorCode::TRANSFER_FAILED, $firstError);
        }

        return $response;
    }

    /**
     * Transfer workspaces to another user.
     */
    public function transferWorkspaces(
        RequestContext $requestContext,
        TransferWorkspacesRequestDTO $requestDTO
    ): array {
        $fromUserId = $requestContext->getUserAuthorization()->getId();
        $organizationCode = $requestContext->getUserAuthorization()->getOrganizationCode();
        $toUserId = $requestDTO->getReceiverId();
        $shareToMe = $requestDTO->isShareToMe();
        // Only use share_role when share_to_me is true, otherwise ignore it completely
        $shareRole = $shareToMe ? $requestDTO->getShareRole() : '';
        // Only use retain_original_location when share_to_me is true
        $retainOriginalLocation = $shareToMe ? $requestDTO->getRetainOriginalLocation() : false;
        $fromUserName = $this->getUserDisplayName($fromUserId, $requestContext);

        if (! $this->packageFilterService->canTransferProject($organizationCode)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::NO_PERMISSION_TO_TRANSFER);
        }

        // 1. Validate receiver
        $this->validateReceiver($fromUserId, $toUserId, $organizationCode);

        // 2. Generate batch ID
        $batchId = $this->transferDomainService->generateBatchId();

        // 3. Process each workspace
        $results = [];
        foreach ($requestDTO->getWorkspaceIds() as $workspaceId) {
            $result = $this->transferSingleWorkspace(
                (int) $workspaceId,
                $fromUserId,
                $toUserId,
                $organizationCode,
                $batchId,
                $shareToMe,
                $shareRole,
                $fromUserName,
                $retainOriginalLocation
            );
            $results[] = $result;
        }

        $response = $this->buildBatchResponse($batchId, $results);

        // If all transfers failed, throw exception for frontend error handling
        if ($response['failed_count'] === $response['total'] && $response['total'] > 0) {
            $firstError = $results[0]['error'] ?? trans('transfer.transfer_failed');
            ExceptionBuilder::throw(SuperAgentErrorCode::TRANSFER_FAILED, $firstError);
        }

        return $response;
    }

    /**
     * Transfer single project with full member handling.
     * Uses batch operations for consistency with workspace transfer.
     */
    protected function transferSingleProject(
        int $projectId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        string $batchId,
        bool $shareToMe,
        string $shareRole,
        string $fromUserName,
        bool $retainOriginalLocation = false
    ): array {
        // Pre-transaction: Check receiver's current member status using batch method
        $projectIds = [$projectId];
        $receiverMemberMap = $this->projectMemberDomainService->batchGetMembersByProjectsAndUser($projectIds, $toUserId);
        $receiverMember = $receiverMemberMap[$projectId] ?? null;
        $receiverWasMember = $receiverMember !== null;
        $receiverOriginalRole = $receiverWasMember ? $receiverMember->getRole()->value : null;

        try {
            Db::beginTransaction();

            // Application layer handles i18n
            $transferSuffix = trans('workspace.transferred_from');

            // Get original workspace name for naming (if needed)
            $originalWorkspaceName = '';
            if (! $retainOriginalLocation || ! $shareToMe) {
                $project = $this->projectRepository->findById($projectId);
                if ($project) {
                    $workspaceEntity = $this->workspaceRepository->findById($project->getWorkspaceId());
                    $originalWorkspaceName = $workspaceEntity?->getName() ?? '';
                }
            }

            // Build transfer options
            $options = TransferOptions::forProject(
                $fromUserName,
                $transferSuffix,
                $shareToMe,
                $shareRole,
                $retainOriginalLocation,
                $originalWorkspaceName
            );

            // Step 1: Transfer ownership via unified domain service interface
            $transferResult = $this->transferDomainService->transferProject(
                $projectId,
                $fromUserId,
                $toUserId,
                $organizationCode,
                $options
            );

            $originalWorkspaceId = $transferResult->getOriginalWorkspaceIdForProject() ?? 0;

            if (! $transferResult->isSuccess()) {
                Db::rollBack();
                // Get error message key and translate it
                $errorKey = $transferResult->getErrorMessage() ?? 'transfer.transfer_failed';
                $translatedError = trans($errorKey);

                // Log failed transfer attempt
                $this->logFailedTransfer(
                    $batchId,
                    $organizationCode,
                    TransferType::PROJECT,
                    $projectId,
                    '',
                    $fromUserId,
                    $toUserId,
                    $translatedError
                );
                return [
                    'resource_id' => (string) $projectId,
                    'status' => 'failed',
                    'error' => $translatedError,
                ];
            }

            // Step 2: Handle receiver membership using batch method
            $this->projectMemberDomainService->batchHandleReceiverMembership(
                $projectIds,
                $toUserId,
                $fromUserId,
                $organizationCode,
                $receiverMemberMap
            );

            // Step 3: Handle original owner membership using batch method
            $this->projectMemberDomainService->batchHandleOriginalOwnerMembership(
                $projectIds,
                $fromUserId,
                $organizationCode,
                $shareToMe,
                $shareRole,
                $originalWorkspaceId
            );

            // If transferred project still has collaborators, ensure collaboration is enabled.
            $this->enableCollaborationForTransferredProjects($projectIds);

            // Step 4: Record operation log (within transaction)
            $this->recordOperationLog(
                $transferResult->getProject(),
                $fromUserId,
                $toUserId,
                $organizationCode,
                $shareToMe,
                $shareRole,
                $receiverWasMember,
                $receiverOriginalRole
            );

            Db::commit();

            // Post-transaction: Audit logging & Event dispatching

            // Save audit log (outside transaction, failure won't affect business)
            $this->saveTransferAuditLog(
                $batchId,
                $organizationCode,
                TransferType::PROJECT,
                $projectId,
                $transferResult->getProject()->getProjectName(),
                $fromUserId,
                $toUserId,
                $shareToMe,
                $shareRole,
                $transferResult->getFilesCount(),
                $receiverWasMember,
                $receiverOriginalRole
            );

            // Dispatch domain event for decoupled processing
            $this->eventDispatcher->dispatch(new ProjectTransferredEvent(
                projectId: $projectId,
                projectName: $transferResult->getProject()->getProjectName(),
                fromUserId: $fromUserId,
                toUserId: $toUserId,
                organizationCode: $organizationCode,
                shareToOriginal: $shareToMe,
                shareRole: $shareRole,
                transferredAt: new DateTimeImmutable(),
            ));

            return $transferResult->toApiResponse($projectId);
        } catch (Throwable $e) {
            Db::rollBack();

            // Log failed transfer
            $this->logFailedTransfer(
                $batchId,
                $organizationCode,
                TransferType::PROJECT,
                $projectId,
                '',
                $fromUserId,
                $toUserId,
                $e->getMessage()
            );

            // Return failure result with internationalized error message
            return [
                'resource_id' => (string) $projectId,
                'status' => 'failed',
                'error' => trans('system.system_error'),
            ];
        }
    }

    /**
     * Transfer single workspace with full member handling.
     * Optimized version using batch operations for better performance.
     */
    protected function transferSingleWorkspace(
        int $workspaceId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        string $batchId,
        bool $shareToMe,
        string $shareRole,
        string $fromUserName,
        bool $retainOriginalLocation = false
    ): array {
        try {
            Db::beginTransaction();

            // Application layer handles i18n
            $transferSuffix = trans('workspace.transferred_from');

            // Build transfer options
            $options = TransferOptions::forWorkspace(
                $fromUserName,
                $transferSuffix,
                $shareToMe,
                $shareRole,
                $retainOriginalLocation
            );

            // Step 1: Transfer workspace via unified domain service interface
            $transferResult = $this->transferDomainService->transferWorkspace(
                $workspaceId,
                $fromUserId,
                $toUserId,
                $organizationCode,
                $options
            );

            $originalWorkspaceId = ($retainOriginalLocation && $shareToMe) ? $workspaceId : 0;

            if (! $transferResult->isSuccess()) {
                Db::rollBack();
                $errorKey = $transferResult->getErrorMessage() ?? 'transfer.transfer_failed';
                $translatedError = trans($errorKey);

                $this->logFailedTransfer(
                    $batchId,
                    $organizationCode,
                    TransferType::WORKSPACE,
                    $workspaceId,
                    '',
                    $fromUserId,
                    $toUserId,
                    $translatedError
                );

                return [
                    'resource_id' => (string) $workspaceId,
                    'status' => 'failed',
                    'error' => $translatedError,
                ];
            }

            // Step 2: Batch handle member relationships using optimized methods
            $projectIds = array_map('intval', $transferResult->getTransferredProjectIds());

            // Pre-query: Batch get receiver member status for all projects
            $receiverMemberMap = $this->projectMemberDomainService->batchGetMembersByProjectsAndUser(
                $projectIds,
                $toUserId
            );

            // Determine receiver membership status for audit log
            $receiverWasMemberForWorkspace = false;
            $receiverOriginalRoleForWorkspace = null;
            foreach ($receiverMemberMap as $member) {
                if ($member !== null) {
                    $receiverWasMemberForWorkspace = true;
                    $receiverOriginalRoleForWorkspace = $member->getRole()->value;
                    break;
                }
            }

            // Batch handle receiver membership
            $this->projectMemberDomainService->batchHandleReceiverMembership(
                $projectIds,
                $toUserId,
                $fromUserId,
                $organizationCode,
                $receiverMemberMap
            );

            // Batch handle original owner membership
            $this->projectMemberDomainService->batchHandleOriginalOwnerMembership(
                $projectIds,
                $fromUserId,
                $organizationCode,
                $shareToMe,
                $shareRole,
                $originalWorkspaceId
            );

            // If transferred project still has collaborators, ensure collaboration is enabled.
            $this->enableCollaborationForTransferredProjects($projectIds);

            Db::commit();

            // Post-transaction: Save audit log
            $this->saveWorkspaceTransferAuditLog(
                $batchId,
                $organizationCode,
                $workspaceId,
                $transferResult->getWorkspace()->getName(),
                $fromUserId,
                $toUserId,
                $shareToMe,
                $shareRole,
                $transferResult->getTransferredProjectIds(),
                $transferResult->getProjectResults(),
                $transferResult->getFilesCount(),
                $receiverWasMemberForWorkspace,
                $receiverOriginalRoleForWorkspace
            );

            return $transferResult->toApiResponse($workspaceId);
        } catch (Throwable $e) {
            Db::rollBack();

            $this->logFailedTransfer(
                $batchId,
                $organizationCode,
                TransferType::WORKSPACE,
                $workspaceId,
                '',
                $fromUserId,
                $toUserId,
                $e->getMessage()
            );

            return [
                'resource_id' => (string) $workspaceId,
                'status' => 'failed',
                'error' => trans('system.system_error'),
            ];
        }
    }

    /**
     * Record project operation log using entity.
     * @param mixed $project
     */
    protected function recordOperationLog(
        $project,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        bool $shareToMe,
        string $shareRole,
        bool $receiverWasMember,
        ?string $receiverOriginalRole
    ): void {
        $logEntity = new ProjectOperationLogEntity();
        $logEntity->setProjectId($project->getId());
        $logEntity->setUserId($fromUserId);
        $logEntity->setOrganizationCode($organizationCode);
        $logEntity->setOperationAction('transfer_ownership');
        $logEntity->setResourceType('project');
        $logEntity->setResourceId((string) $project->getId());
        $logEntity->setResourceName($project->getProjectName());
        $logEntity->setOperationDetails([
            'from_user_id' => $fromUserId,
            'to_user_id' => $toUserId,
            'share_to_original' => $shareToMe,
            'share_role' => $shareRole,
            'receiver_was_member' => $receiverWasMember,
            'receiver_original_role' => $receiverOriginalRole,
        ]);

        $this->operationLogDomainService->saveOperationLog($logEntity);
    }

    /**
     * Save transfer audit log (called after transaction commit).
     */
    protected function saveTransferAuditLog(
        string $batchId,
        string $organizationCode,
        TransferType $transferType,
        int $resourceId,
        string $resourceName,
        string $fromUserId,
        string $toUserId,
        bool $shareToOriginal,
        string $shareRole,
        int $filesCount,
        bool $receiverWasMember,
        ?string $receiverOriginalRole
    ): void {
        $logEntity = new TransferLogEntity();
        $logEntity->setBatchId($batchId);
        $logEntity->setOrganizationCode($organizationCode);
        $logEntity->setTransferType($transferType);
        $logEntity->setResourceId($resourceId);
        $logEntity->setResourceName($resourceName);
        $logEntity->setFromUserId($fromUserId);
        $logEntity->setToUserId($toUserId);
        $logEntity->setShareToOriginal($shareToOriginal);
        $logEntity->setShareRole($shareRole);
        $logEntity->setFilesCount($filesCount);
        $logEntity->markAsSuccess($filesCount, [
            'projects' => [
                [
                    'id' => $resourceId,
                    'name' => $resourceName,
                    'status' => 'success',
                    'files_count' => $filesCount,
                ],
            ],
            'receiver_was_member' => $receiverWasMember,
            'receiver_original_role' => $receiverOriginalRole,
            'member_added' => ! $receiverWasMember,
            'member_role' => MemberRole::OWNER->value,
        ]);

        try {
            $this->transferLogDomainService->saveLog($logEntity);
        } catch (Throwable $e) {
            // Log error but don't throw - audit logging failure shouldn't affect business
        }
    }

    /**
     * Save workspace transfer audit log.
     */
    protected function saveWorkspaceTransferAuditLog(
        string $batchId,
        string $organizationCode,
        int $workspaceId,
        string $workspaceName,
        string $fromUserId,
        string $toUserId,
        bool $shareToOriginal,
        string $shareRole,
        array $projectIds,
        array $projectResults,
        int $filesCount,
        bool $receiverWasMember,
        ?string $receiverOriginalRole
    ): void {
        $logEntity = new TransferLogEntity();
        $logEntity->setBatchId($batchId);
        $logEntity->setOrganizationCode($organizationCode);
        $logEntity->setTransferType(TransferType::WORKSPACE);
        $logEntity->setResourceId($workspaceId);
        $logEntity->setResourceName($workspaceName);
        $logEntity->setFromUserId($fromUserId);
        $logEntity->setToUserId($toUserId);
        $logEntity->setShareToOriginal($shareToOriginal);
        $logEntity->setShareRole($shareRole);
        $logEntity->setProjectsCount(count($projectIds));
        $logEntity->setFilesCount($filesCount);
        $logEntity->markAsSuccess($filesCount, [
            'workspace' => [
                'id' => $workspaceId,
                'name' => $workspaceName,
            ],
            'projects' => $projectResults,
            'receiver_was_member' => $receiverWasMember,
            'receiver_original_role' => $receiverOriginalRole,
            'member_added' => ! $receiverWasMember,
            'member_role' => MemberRole::OWNER->value,
        ]);

        try {
            $this->transferLogDomainService->saveLog($logEntity);
        } catch (Throwable $e) {
            // Silently fail
        }
    }

    /**
     * Log failed transfer attempt.
     */
    protected function logFailedTransfer(
        string $batchId,
        string $organizationCode,
        TransferType $transferType,
        int $resourceId,
        string $resourceName,
        string $fromUserId,
        string $toUserId,
        string $errorMessage
    ): void {
        $logEntity = new TransferLogEntity();
        $logEntity->setBatchId($batchId);
        $logEntity->setOrganizationCode($organizationCode);
        $logEntity->setTransferType($transferType);
        $logEntity->setResourceId($resourceId);
        $logEntity->setResourceName($resourceName);
        $logEntity->setFromUserId($fromUserId);
        $logEntity->setToUserId($toUserId);
        $logEntity->markAsFailed($errorMessage);

        try {
            $this->transferLogDomainService->saveLog($logEntity);
        } catch (Throwable $e) {
            // Silently fail
        }
    }

    /**
     * Validate receiver user.
     */
    protected function validateReceiver(string $currentUserId, string $receiverId, string $organizationCode): void
    {
        if ($currentUserId === $receiverId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::CANNOT_TRANSFER_TO_SELF);
        }

        $receiver = $this->magicUserDomainService->getByUserId($receiverId);
        if (! $receiver) {
            ExceptionBuilder::throw(SuperAgentErrorCode::RECEIVER_NOT_FOUND);
        }

        // Receiver must be in the same organization
        if ($receiver->getOrganizationCode() !== $organizationCode) {
            ExceptionBuilder::throw(SuperAgentErrorCode::NO_PERMISSION_TO_TRANSFER);
        }
    }

    /**
     * Build batch response.
     */
    protected function buildBatchResponse(string $batchId, array $results): array
    {
        $successCount = count(array_filter($results, fn ($r) => $r['status'] === 'success'));
        $failedCount = count($results) - $successCount;

        return [
            'batch_id' => $batchId,
            'total' => count($results),
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'results' => $results,
        ];
    }

    /**
     * Resolve user display name (real_name > nickname > userId).
     */
    protected function getUserDisplayName(string $userId, RequestContext $requestContext): string
    {
        $user = $this->magicUserDomainService->getByUserId($userId);
        if ($user) {
            $nickname = trim($user->getNickname());
            if ($nickname !== '') {
                return $nickname;
            }
        }

        return $userId;
    }

    /**
     * Enable collaboration for transferred projects that have collaborator members.
     *
     * Effective collaborators are ACTIVE members in MANAGE/EDITOR/VIEWER roles
     * (OWNER excluded).
     */
    private function enableCollaborationForTransferredProjects(array $projectIds): void
    {
        if (empty($projectIds)) {
            return;
        }

        $projectIdsWithEffectiveCollaborators = $this->projectMemberDomainService
            ->getProjectIdsWithEffectiveCollaborators($projectIds);
        if (empty($projectIdsWithEffectiveCollaborators)) {
            return;
        }

        $this->projectDomainService->batchEnableCollaboration($projectIdsWithEffectiveCollaborators);
    }
}
