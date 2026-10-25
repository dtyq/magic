<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use RuntimeException;
use Throwable;

/**
 * Phase 1 access check before mounting referenced projects — all-or-nothing.
 *
 * A single denied access aborts the entire operation. Published-share
 * denials keep their BusinessException. Collaboration denials collapse
 * into a RuntimeException, which handleChatMessage() turns into a user
 * notification so the message never reaches the agent.
 *
 * Password-protected @micro_app mentions are planned as collaboration
 * after the normalizer confirms membership. This guard does not interpret
 * share error codes as control flow.
 */
final class ReferencedProjectMountGuard
{
    public function __construct(
        private readonly ReferencedProjectMountAuthorizer $authorizer,
    ) {
    }

    /**
     * @param list<ReferencedProjectMount> $mounts
     * @param callable(int): void $assertCollaborationAccessible
     */
    public function assertAllAccessible(
        array $mounts,
        DataIsolation $dataIsolation,
        callable $assertCollaborationAccessible,
    ): void {
        $denied = [];
        foreach ($mounts as $mount) {
            try {
                if ($mount->accessKind === ReferencedProjectAccessKind::PublishedShare) {
                    $this->authorizer->assertPublishedShareAccessible($mount, $dataIsolation);
                    continue;
                }
                $assertCollaborationAccessible((int) $mount->projectId);
            } catch (BusinessException $e) {
                if ($mount->accessKind === ReferencedProjectAccessKind::PublishedShare) {
                    throw $e;
                }
                $denied[] = $mount->projectId;
            } catch (Throwable) {
                $denied[] = $mount->projectId;
            }
        }
        if ($denied !== []) {
            throw new RuntimeException(sprintf(
                'Cannot mount referenced projects [%s]: access denied',
                implode(', ', $denied)
            ));
        }
    }
}
