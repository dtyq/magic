<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\Transfer;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\SuperMagic\Agent\Collaboration\AgentResourceAdapter;
use App\Application\SuperMagic\Common\Collaboration\Policy\ResourceAccessPolicyService;
use App\Application\SuperMagic\Skill\Collaboration\SkillResourceAdapter;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as VisibilityResourceType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentSourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Event\AgentMarketUpdatedEvent;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\Domain\SuperMagic\Common\Event\ResourceTransferredEvent;
use App\Domain\SuperMagic\Common\Repository\ResourceTransferRepository;
use App\Domain\SuperMagic\Project\Entity\TransferLogEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferOptions;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferStatus;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferType;
use App\Domain\SuperMagic\Project\Event\ProjectTransferredEvent;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Project\Service\TransferDomainService;
use App\Domain\SuperMagic\Project\Service\TransferLogDomainService;
use App\Domain\SuperMagic\Skill\Entity\UserSkillEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\DTO\Request\TransferResourceRequestDTO;
use DateTimeImmutable;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Throwable;

use function Hyperf\Translation\trans;

/** 在同一事务内转移资源及其编辑项目的权限。 */
class ResourceTransferAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly ResourceTransferRepository $repository,
        private readonly OrganizationDomainService $organizations,
        private readonly MagicUserDomainService $users,
        private readonly PackageFilterInterface $packages,
        private readonly OperationPermissionDomainService $permissions,
        private readonly ResourceAccessPolicyService $policy,
        private readonly AgentResourceAdapter $agents,
        private readonly SkillResourceAdapter $skills,
        private readonly TransferDomainService $projects,
        private readonly ProjectMemberDomainService $members,
        private readonly ProjectDomainService $projectDomain,
        private readonly UserAgentDomainService $ownerships,
        private readonly SkillDomainService $skillOwnerships,
        private readonly TransferLogDomainService $logs,
        private readonly EventDispatcherInterface $events,
        private readonly LoggerFactory $loggerFactory,
    ) {
    }

    /** 根据组织用户身份转移资源，并同步关联项目及权限。 */
    public function transfer(MagicUserAuthorization $authorization, string $code, bool $isAgent, TransferResourceRequestDTO $request): array
    {
        $org = $authorization->getOrganizationCode();
        $sender = $authorization->getId();
        $organization = $this->organizations->getByCode($org);
        if (! $organization || $organization->isPersonal() || ! $this->packages->canTransferProject($org)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::NO_PERMISSION_TO_TRANSFER, 'transfer.no_permission_to_transfer');
        }
        $receiver = $this->users->getByUserId($request->receiverId);
        if ($sender === $request->receiverId || ! $receiver || $receiver->getOrganizationCode() !== $org
            || $receiver->getStatus() !== UserStatus::Activated) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }
        $isolation = PermissionDataIsolation::create($org, $sender);
        $type = $isAgent ? ResourceType::CustomAgent : ResourceType::Skill;
        $adapter = $isAgent ? $this->agents : $this->skills;
        $role = $request->shareToMe ? $request->shareRole : '';

        $projectId = 0;
        $projectName = '';
        $marketIds = [];
        $response = Db::transaction(function () use ($authorization, $code, $isAgent, $request, $org, $sender, $isolation, $type, $adapter, $role, &$projectId, &$projectName, &$marketIds) {
            $resource = $this->repository->lock($isAgent, $org, $code);
            // Recheck after acquiring the resource lock; a stale editor cannot transfer twice.
            if (! $resource || $resource->getAttribute($isAgent ? 'creator' : 'creator_id') !== $sender
                || in_array($resource->getAttribute('source_type'), ['MARKET', 'SYSTEM', 'OFFICIAL'], true)
                || ! $this->permissions->isResourceOwner($isolation, $type, $code, $sender)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::NO_PERMISSION_TO_TRANSFER, 'transfer.no_permission_to_transfer');
            }
            $context = $adapter->getResource($authorization, $code);
            $projectId = $adapter->getProjectId($context);
            // Referenced skills and knowledge keep their own ownership and access rules.
            // Transferring the agent does not grant access to those independent resources.
            if ($projectId > 0) {
                $project = $this->repository->lockProject($projectId);
                if (! $project || $project->getAttribute('user_id') !== $sender || $project->getAttribute('user_organization_code') !== $org) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
                }
                $projectName = (string) $project->getAttribute('project_name');
                $result = $this->projects->transferProject(
                    $projectId,
                    $sender,
                    $request->receiverId,
                    $org,
                    TransferOptions::forProject($sender, trans('workspace.transferred_from'), $request->shareToMe, $role)
                );
                if (! $result->isSuccess()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, $result->getErrorMessage() ?? 'project.project_access_denied');
                }
                $this->members->batchHandleReceiverMembership(
                    [$projectId],
                    $request->receiverId,
                    $sender,
                    $org,
                    $this->members->batchGetMembersByProjectsAndUser([$projectId], $request->receiverId)
                );
                $this->members->batchHandleOriginalOwnerMembership([$projectId], $sender, $org, $request->shareToMe, $role);
                $this->members->syncOwnerProjectWorkspaceBindings($request->receiverId, [$projectId], $result->getProject()->getWorkspaceId(), $org);
                // The original owner and existing collaborators still need editing-project access.
                $collaborativeProjects = $this->members->getProjectIdsWithEffectiveCollaborators([$projectId]);
                if ($collaborativeProjects !== []) {
                    $this->projectDomain->batchEnableCollaboration($collaborativeProjects);
                }
            }
            $this->permissions->transferOwner($isolation, $type, $code, $request->receiverId, $request->shareToMe);
            if ($request->shareToMe) {
                $permission = new OperationPermissionEntity();
                $permission->setOrganizationCode($org);
                $permission->setResourceType($type);
                $permission->setResourceId($code);
                $permission->setTargetType(TargetType::UserId);
                $permission->setTargetId($sender);
                $permission->setOperation(Operation::fromAlias($role));
                $permission->setCreator($sender);
                $permission->setModifier($sender);
                $this->permissions->batchUpsertResourceOperations($isolation, $type, $code, [$permission]);
            }
            $this->repository->changeOwner($resource, $isAgent, $request->receiverId);
            if ($isAgent) {
                $this->transferOwnershipRecord($org, $sender, $request, $code);
                // Market responsibility follows the live owner, without rewriting published versions.
                $marketIds = $this->repository->transferOrganizationMarketOwner($org, $code, $request->receiverId);
            } else {
                $this->transferSkillOwnershipRecord($org, $sender, $request, $code, (string) $resource->getAttribute('source_type'));
            }
            // Reconcile organization-market derived access after the old owner loses access.
            $adapter->afterCollaboratorRemoved($isolation, $code);
            $visibilityType = $isAgent ? VisibilityResourceType::SUPER_MAGIC_AGENT : VisibilityResourceType::SKILL;
            if (! $request->shareToMe) {
                // Reads also accept visibility grants; remove only the sender's direct grant.
                $this->policy->removeReadableUsers($isolation, $visibilityType, $code, [$sender]);
            }
            $log = new TransferLogEntity();
            $log->setBatchId($this->projects->generateBatchId())
                ->setOrganizationCode($org)->setTransferType($isAgent ? TransferType::AGENT : TransferType::SKILL)
                ->setResourceId((int) $resource->getAttribute('id'))
                ->setResourceName($code)->setFromUserId($sender)->setToUserId($request->receiverId)
                ->setShareToOriginal($request->shareToMe)->setShareRole($role)->setStatus(TransferStatus::SUCCESS)
                ->setExtra(['code' => $code, 'project_id' => $projectId]);
            // Persist audit atomically: a logging failure rolls back the entire transfer.
            $this->logs->saveLog($log);
            $operations = $this->policy->getReadableResourceOperations($isolation, $type, $visibilityType, [$code]);
            return ['code' => $code, 'owner_id' => $request->receiverId, 'user_role' => ($operations[$code] ?? null)?->toAlias()];
        });
        $events = [static fn () => new ResourceTransferredEvent($code, $isAgent ? 'agent' : 'skill', $org, $sender, $request->receiverId)];
        if ($projectId > 0) {
            $events[] = static fn () => new ProjectTransferredEvent(
                $projectId,
                $projectName,
                $sender,
                $request->receiverId,
                $org,
                $request->shareToMe,
                $role,
                new DateTimeImmutable()
            );
        }
        foreach ($marketIds as $marketId) {
            $events[] = static fn () => new AgentMarketUpdatedEvent((string) $marketId, $org, $sender);
        }
        foreach ($events as $createEvent) {
            try {
                $this->events->dispatch($createEvent());
            } catch (Throwable $error) {
                // Ownership is committed; one failed notification must not skip the others or invite retries.
                $this->loggerFactory->get('resource-transfer')->error('Transfer event dispatch failed', ['exception' => $error]);
            }
        }
        return $response;
    }

    private function transferSkillOwnershipRecord(string $org, string $sender, TransferResourceRequestDTO $request, string $code, string $sourceType): void
    {
        $receiverIsolation = SkillDataIsolation::create($org, $request->receiverId);
        $ownership = $this->skillOwnerships->findUserSkillOwnershipByCode($receiverIsolation, $code) ?? new UserSkillEntity();
        // A previously installed market copy must become the editable live resource.
        $ownership->setOrganizationCode($org)->setUserId($request->receiverId)->setSkillCode($code)
            ->setSourceType(SkillSourceType::from($sourceType))->setSourceId(null)->setSkillVersionId(null);
        $this->skillOwnerships->saveUserSkillOwnership($receiverIsolation, $ownership);
        if (! $request->shareToMe) {
            $this->skillOwnerships->deleteUserSkillOwnership(SkillDataIsolation::create($org, $sender), $code);
        }
    }

    private function transferOwnershipRecord(string $org, string $sender, TransferResourceRequestDTO $request, string $code): void
    {
        $receiverIsolation = SuperMagicAgentDataIsolation::create($org, $request->receiverId);
        $ownership = $this->ownerships->findUserAgentOwnershipByCode($receiverIsolation, $code) ?? new UserAgentEntity();
        $ownership->setOrganizationCode($org)->setUserId($request->receiverId)->setAgentCode($code)
            ->setSourceType(AgentSourceType::LOCAL_CREATE)->setSourceId(null)->setAgentVersionId(null);
        $this->ownerships->saveUserAgentOwnership($receiverIsolation, $ownership);
        if (! $request->shareToMe) {
            $this->ownerships->deleteUserAgentOwnership(SuperMagicAgentDataIsolation::create($org, $sender), $code);
        }
    }
}
