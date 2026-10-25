<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Service\MicroApp;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\HiddenType;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Entity\ValueObject\TransferResult;
use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppTransferRepository;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;

class MicroAppTransferDomainService
{
    public function __construct(
        private readonly MicroAppTransferRepository $repository,
        private readonly WorkspaceRepositoryInterface $workspaces,
        private readonly WorkspaceDomainService $workspaceDomain,
    ) {
    }

    /** Null means an ordinary project; runtime projects are deliberately never transferred. */
    public function transferIfMicroApp(int $projectId, string $sender, string $receiver, string $org): ?TransferResult
    {
        $project = $this->repository->lockProject($projectId);
        if ($project === null) {
            return TransferResult::failed('transfer.project_not_found');
        }
        if ($project->getUserId() !== $sender || $project->getUserOrganizationCode() !== $org
            || $project->getHiddenType() === HiddenType::MICRO_APP_RUNTIME->value) {
            return TransferResult::failed('transfer.no_permission_to_transfer');
        }
        $app = $this->repository->lockAppByProject($projectId, $org);
        $workspace = $this->workspaces->findById((int) $project->getWorkspaceId());
        if ($app === null && $project->getProjectMode() !== ProjectMode::MICRO_APP->value
            && $workspace?->getWorkspaceType() !== WorkspaceType::MicroApp->value) {
            return null;
        }
        $target = $this->workspaceDomain->getOrCreateWorkspaceByType(DataIsolation::create($org, $receiver), WorkspaceType::MicroApp);
        $project->setUserId($receiver)->setWorkspaceId($target->getId())->setUpdatedAt(date('Y-m-d H:i:s'));
        $this->repository->changeProjectOwner($project);
        if ($app !== null) {
            $this->repository->changeAppOwner($app, $receiver);
        }
        return TransferResult::successProject($project, 0);
    }

    /** A system workspace cannot be transferred wholesale through the ordinary workspace API. */
    public function canTransferWorkspace(int $workspaceId): bool
    {
        return $this->workspaces->findById($workspaceId)?->getWorkspaceType() !== WorkspaceType::MicroApp->value
            && ! $this->repository->hasMicroAppsInWorkspace($workspaceId);
    }
}
