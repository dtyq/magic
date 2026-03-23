<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Code;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\MagicClawRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\DbConnection\Db;

readonly class MagicClawDomainService
{
    public function __construct(
        private MagicClawRepositoryInterface $magicClawRepository,
    ) {
    }

    /**
     * Create a new magic claw.
     */
    public function createClaw(MagicClawEntity $entity): MagicClawEntity
    {
        $entity->setCode(Code::MagicClaw->gen());
        return Db::transaction(function () use ($entity) {
            return $this->magicClawRepository->create($entity);
        });
    }

    /**
     * Update an existing magic claw (with pessimistic lock to prevent concurrent tampering).
     */
    public function updateClaw(string $code, string $userId, string $organizationCode, string $name, string $description, string $icon): MagicClawEntity
    {
        return Db::transaction(function () use ($code, $userId, $organizationCode, $name, $description, $icon) {
            $entity = $this->getByCodeOrFail($code, $userId, $organizationCode);

            if ($name !== '') {
                $entity->setName($name);
            }
            $entity->setDescription($description);
            $entity->setIcon($icon);
            $entity->setUpdatedUid($userId);

            return $this->magicClawRepository->save($entity);
        });
    }

    /**
     * Soft-delete a magic claw (with pessimistic lock).
     */
    public function deleteClaw(string $code, string $userId, string $organizationCode): void
    {
        Db::transaction(function () use ($code, $userId, $organizationCode) {
            $entity = $this->getByCodeOrFail($code, $userId, $organizationCode);
            $this->magicClawRepository->delete($entity);
        });
    }

    /**
     * Find a magic claw by code, throw NOT_FOUND if not accessible.
     */
    public function findByCode(string $code, string $userId, string $organizationCode): MagicClawEntity
    {
        return $this->getByCodeOrFail($code, $userId, $organizationCode);
    }

    /**
     * Get paginated list of magic claws for a user.
     *
     * @return array{total: int, list: MagicClawEntity[]}
     */
    public function getList(string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        return $this->magicClawRepository->getList($userId, $organizationCode, $page, $pageSize);
    }

    /**
     * Bind a project to a magic claw.
     */
    public function bindProject(int $clawId, int $projectId): void
    {
        Db::transaction(function () use ($clawId, $projectId) {
            $this->magicClawRepository->updateProjectId($clawId, $projectId);
        });
    }

    private function getByCodeOrFail(string $code, string $userId, string $organizationCode): MagicClawEntity
    {
        $entity = $this->magicClawRepository->findByCode($code, $userId, $organizationCode);
        if ($entity === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
        return $entity;
    }
}
