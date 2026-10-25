<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\DTO\Request\TransferResourceRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\TransferProjectsRequestDTO;

class MicroAppTransferAppService
{
    public function __construct(
        private readonly MicroAppRepositoryInterface $apps,
        private readonly TransferAppService $transfers,
    ) {
    }

    public function transfer(RequestContext $context, int $appId, TransferResourceRequestDTO $request): array
    {
        $app = $this->apps->findById($appId);
        if ($app === null || $app->getOrganizationCode() !== $context->getUserAuthorization()->getOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }
        // The common coordinator rechecks the locked project owner and handles membership,
        // scheduling, audit and errors exactly like existing project transfers.
        return $this->transfers->transferProjects($context, new TransferProjectsRequestDTO([
            'project_ids' => [(string) $app->getProjectId()],
            'receiver_id' => $request->receiverId,
            'share_to_me' => $request->shareToMe,
            'share_role' => $request->shareToMe ? $request->shareRole : '',
            'retain_original_location' => false,
        ]));
    }
}
