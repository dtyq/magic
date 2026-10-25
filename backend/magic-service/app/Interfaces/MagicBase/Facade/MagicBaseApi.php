<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MagicBase\Facade;

use App\Application\MagicBase\Assembler\MagicBaseAssembler;
use App\Application\MagicBase\DTO\BatchCreateRowsRequestDTO;
use App\Application\MagicBase\DTO\BatchDeleteRowsRequestDTO;
use App\Application\MagicBase\DTO\BatchPermissionRequestDTO;
use App\Application\MagicBase\Service\MagicBaseAdminAppService;
use App\Application\MagicBase\Service\MagicBasePermissionAppService;
use App\Application\MagicBase\Service\MagicBaseQueryAppService;
use App\Application\MagicBase\Service\MagicBaseRelationAppService;
use App\Application\MagicBase\Service\MagicBaseRowAppService;
use App\Application\MagicBase\Service\MagicBaseTableAppService;
use App\Application\MagicBase\Support\MagicBaseAccessControl;
use App\Application\MagicBase\Support\MagicBaseRuntimeProjectAccessContext;
use App\Domain\MagicBase\Exception\MagicBaseExceptionBuilder;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\SuperMagic\Utils\AccessTokenUtil;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\MagicBase\Assembler\MagicBaseResponseAssembler;
use App\Interfaces\MagicBase\DTO\CreateColumnRequest;
use App\Interfaces\MagicBase\DTO\CreateRelationRequest;
use App\Interfaces\MagicBase\DTO\CreateRowRequest;
use App\Interfaces\MagicBase\DTO\CreateTableRequest;
use App\Interfaces\MagicBase\DTO\QueryRowsRequest;
use App\Interfaces\MagicBase\DTO\UpdateTableRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use RuntimeException;
use Throwable;

#[ApiResponse('low_code')]
class MagicBaseApi extends AbstractApi
{
    #[Inject]
    protected MagicBaseTableAppService $tableAppService;

    #[Inject]
    protected MagicBaseRowAppService $rowAppService;

    #[Inject]
    protected MagicBaseQueryAppService $queryAppService;

    #[Inject]
    protected MagicBaseRelationAppService $relationAppService;

    #[Inject]
    protected MagicBasePermissionAppService $permissionAppService;

    #[Inject]
    protected MagicBaseAdminAppService $adminAppService;

    #[Inject]
    protected ResourceShareDomainService $resourceShareDomainService;

    #[Inject]
    protected MagicBaseAccessControl $accessControl;

    public function createTable(RequestInterface $request, string $projectId)
    {
        $requestDTO = new CreateTableRequest($request->all());
        $result = $this->tableAppService->createTable(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            MagicBaseAssembler::toCreateTableRequestDTO($requestDTO)
        );
        return MagicBaseResponseAssembler::tableDetail($result->table, $result->columns);
    }

    public function listTables(string $projectId): array
    {
        $projectId = self::parseId($projectId, '项目ID');
        $tables = $this->tableAppService->listTables($this->resolveRuntimeAuthorization($projectId), $projectId);
        return array_map(static fn (mixed $table) => MagicBaseResponseAssembler::tableSummary($table), iterator_to_array($tables));
    }

    public function getTable(string $projectId, string $tableId)
    {
        $projectId = self::parseId($projectId, '项目ID');
        $result = $this->tableAppService->getTable(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
        );
        return MagicBaseResponseAssembler::tableDetail($result->table, $result->columns);
    }

    public function updateTable(RequestInterface $request, string $projectId, string $tableId)
    {
        $requestDTO = new UpdateTableRequest($request->all());
        $result = $this->tableAppService->updateTable(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toUpdateTableRequestDTO($requestDTO),
        );
        return MagicBaseResponseAssembler::tableDetail($result->table, $result->columns);
    }

    public function deleteTable(string $projectId, string $tableId)
    {
        $this->tableAppService->deleteTable(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
        );
    }

    public function createColumn(RequestInterface $request, string $projectId, string $tableId)
    {
        $requestDTO = new CreateColumnRequest($request->all());
        $column = $this->tableAppService->createColumn(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toCreateColumnRequestDTO($requestDTO),
        );
        return MagicBaseResponseAssembler::column($column);
    }

    public function updateColumn(RequestInterface $request, string $projectId, string $tableId, string $columnId)
    {
        $requestDTO = new CreateColumnRequest($request->all());
        $column = $this->tableAppService->updateColumn(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            self::parseId($columnId, '字段ID'),
            MagicBaseAssembler::toCreateColumnRequestDTO($requestDTO),
        );
        return MagicBaseResponseAssembler::column($column);
    }

    public function deleteColumn(string $projectId, string $tableId, string $columnId)
    {
        $this->tableAppService->deleteColumn(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            self::parseId($columnId, '字段ID'),
        );
    }

    public function createRow(RequestInterface $request, string $projectId, string $tableId)
    {
        $projectId = self::parseId($projectId, '项目ID');
        $requestDTO = new CreateRowRequest($request->all());
        return MagicBaseResponseAssembler::row($this->rowAppService->createRow(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toCreateRowRequestDTO($requestDTO),
        ));
    }

    public function batchCreateRows(RequestInterface $request, string $projectId, string $tableId): array
    {
        $projectId = self::parseId($projectId, '项目ID');
        $result = $this->rowAppService->batchCreateRows(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            BatchCreateRowsRequestDTO::fromArray($request->all()),
        );

        return [
            'created_count' => $result['created_count'],
            'record_ids' => $result['record_ids'],
            'rows' => array_map(
                static fn (mixed $row) => MagicBaseResponseAssembler::row($row),
                $result['rows'],
            ),
        ];
    }

    public function queryRows(RequestInterface $request, string $projectId, string $tableId)
    {
        $projectId = self::parseId($projectId, '项目ID');
        $requestDTO = new QueryRowsRequest($request->all());
        return MagicBaseResponseAssembler::page($this->queryAppService->queryRows(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toQueryRowsRequestDTO($requestDTO),
        ));
    }

    public function getRow(string $projectId, string $tableId, string $recordId)
    {
        $projectId = self::parseId($projectId, '项目ID');
        return MagicBaseResponseAssembler::row($this->queryAppService->showRow(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            self::parseId($recordId, '记录ID'),
            (string) $this->request->query('select', ''),
        ));
    }

    public function updateRow(RequestInterface $request, string $projectId, string $tableId, string $recordId)
    {
        $projectId = self::parseId($projectId, '项目ID');
        $requestDTO = new CreateRowRequest($request->all());
        return MagicBaseResponseAssembler::row($this->rowAppService->updateRow(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            self::parseId($recordId, '记录ID'),
            MagicBaseAssembler::toCreateRowRequestDTO($requestDTO),
        ));
    }

    public function deleteRow(string $projectId, string $tableId, string $recordId)
    {
        $projectId = self::parseId($projectId, '项目ID');
        $this->rowAppService->deleteRow(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            self::parseId($recordId, '记录ID'),
        );
    }

    public function batchDeleteRows(RequestInterface $request, string $projectId, string $tableId): array
    {
        $projectId = self::parseId($projectId, '项目ID');
        $requestDTO = BatchDeleteRowsRequestDTO::fromArray($request->all());
        return $this->rowAppService->batchDeleteRows(
            $this->resolveRuntimeAuthorization($projectId),
            $projectId,
            self::parseId($tableId, '表ID'),
            $requestDTO->getRecordIds(),
        );
    }

    public function createRelation(RequestInterface $request, string $projectId)
    {
        $requestDTO = new CreateRelationRequest($request->all());
        return MagicBaseResponseAssembler::relation($this->relationAppService->createRelation(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            MagicBaseAssembler::toRelationRequestDTO($requestDTO),
        ));
    }

    public function listRelations(string $projectId): array
    {
        $projectId = self::parseId($projectId, '项目ID');
        return array_map(
            static fn (mixed $relation) => MagicBaseResponseAssembler::relation($relation),
            iterator_to_array($this->relationAppService->listRelations(
                $this->resolveRuntimeAuthorization($projectId),
                $projectId,
            ))
        );
    }

    public function updateRelation(RequestInterface $request, string $projectId, string $relationId)
    {
        $requestDTO = new CreateRelationRequest($request->all());
        return MagicBaseResponseAssembler::relation($this->relationAppService->updateRelation(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($relationId, '关系ID'),
            MagicBaseAssembler::toRelationRequestDTO($requestDTO),
        ));
    }

    public function deleteRelation(string $projectId, string $relationId)
    {
        $this->relationAppService->deleteRelation(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($relationId, '关系ID'),
        );
    }

    public function createProjectAdmin(RequestInterface $request, string $projectId)
    {
        return MagicBaseResponseAssembler::admin($this->adminAppService->createProjectAdmin(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            MagicBaseAssembler::toSubjectRequestDTO($request->all()),
        ));
    }

    public function createTableAdmin(RequestInterface $request, string $projectId, string $tableId)
    {
        return MagicBaseResponseAssembler::admin($this->adminAppService->createTableAdmin(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toSubjectRequestDTO($request->all()),
        ));
    }

    public function createTablePermission(RequestInterface $request, string $projectId, string $tableId)
    {
        return MagicBaseResponseAssembler::tablePermission($this->permissionAppService->createTablePermission(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toTablePermissionRequestDTO($request->all()),
        ));
    }

    public function createColumnPermission(RequestInterface $request, string $projectId, string $tableId)
    {
        return MagicBaseResponseAssembler::columnPermission($this->permissionAppService->createColumnPermission(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toColumnPermissionRequestDTO($request->all()),
        ));
    }

    public function createRowPermission(RequestInterface $request, string $projectId, string $tableId)
    {
        return MagicBaseResponseAssembler::rowPermission($this->permissionAppService->createRowPermission(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            MagicBaseAssembler::toRowPermissionRequestDTO($request->all()),
        ));
    }

    public function listPermissions(string $projectId, string $tableId): array
    {
        $permissions = $this->permissionAppService->listPermissions(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
        );

        return [
            'table_permissions' => array_map(
                static fn (mixed $permission) => MagicBaseResponseAssembler::tablePermission($permission),
                $permissions['table_permissions'],
            ),
            'column_permissions' => array_map(
                static fn (mixed $permission) => MagicBaseResponseAssembler::columnPermission($permission),
                $permissions['column_permissions'],
            ),
            'row_permissions' => array_map(
                static fn (mixed $permission) => MagicBaseResponseAssembler::rowPermission($permission),
                $permissions['row_permissions'],
            ),
        ];
    }

    public function batchSavePermissions(RequestInterface $request, string $projectId, string $tableId): array
    {
        $permissions = $this->permissionAppService->batchSavePermissions(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            BatchPermissionRequestDTO::fromArray($request->all()),
        );

        return [
            'table_permissions' => array_map(
                static fn (mixed $permission) => MagicBaseResponseAssembler::tablePermission($permission),
                $permissions['table_permissions'],
            ),
            'column_permissions' => array_map(
                static fn (mixed $permission) => MagicBaseResponseAssembler::columnPermission($permission),
                $permissions['column_permissions'],
            ),
            'row_permissions' => array_map(
                static fn (mixed $permission) => MagicBaseResponseAssembler::rowPermission($permission),
                $permissions['row_permissions'],
            ),
        ];
    }

    public function deletePermission(string $projectId, string $tableId, string $type, string $permissionId): void
    {
        $this->permissionAppService->deletePermission(
            $this->getAuthorization(),
            self::parseId($projectId, '项目ID'),
            self::parseId($tableId, '表ID'),
            $type,
            self::parseId($permissionId, '权限ID'),
        );
    }

    /**
     * Check whether the current real user can access micro-app administrator pages.
     *
     * A share token is only used to validate that the request belongs to the
     * shared project. The administrator decision always uses Authorization's
     * real user and never the share creator/runtime actor.
     */
    public function getProjectAdminAccess(string $projectId): array
    {
        $projectId = self::parseId($projectId, '项目ID');
        $this->accessControl->assertMicroAppActive($projectId);
        $authorization = $this->getOptionalCurrentAuthorization();
        $shareToken = trim((string) $this->request->header('token', ''));

        if ($shareToken !== '') {
            $shareEntity = $this->resolveProjectShare($projectId, $shareToken);
            if ($shareEntity->getShareType() === ShareAccessType::TeamShare->value) {
                if ($authorization === null) {
                    return [
                        'project_id' => (string) $projectId,
                        'is_admin' => false,
                    ];
                }

                $this->resourceShareDomainService->validateShareAccess(
                    $shareEntity,
                    $authorization->getId(),
                    $authorization->getOrganizationCode(),
                    $shareEntity->getShareCode()
                );
            }
        }

        return [
            'project_id' => (string) $projectId,
            'is_admin' => $authorization !== null
                && $this->accessControl->isProjectDataAdmin($authorization, $projectId),
        ];
    }

    private static function parseId(string $id, string $label): int
    {
        if (! ctype_digit($id)) {
            MagicBaseExceptionBuilder::validateFailed($label);
        }
        return (int) $id;
    }

    private function resolveRuntimeAuthorization(int $projectId): MagicUserAuthorization
    {
        $this->accessControl->assertMicroAppActive($projectId);

        $shareToken = trim((string) $this->request->header('token', ''));
        if ($shareToken === '') {
            return $this->getAuthorization();
        }

        $shareEntity = $this->resolveProjectShare($projectId, $shareToken);

        $currentAuthorization = $this->getOptionalCurrentAuthorization();
        if ($shareEntity->getShareType() === ShareAccessType::TeamShare->value) {
            if ($currentAuthorization === null) {
                $this->denyRuntimeAccess();
            }

            $this->resourceShareDomainService->validateShareAccess(
                $shareEntity,
                $currentAuthorization->getId(),
                $currentAuthorization->getOrganizationCode(),
                $shareEntity->getShareCode()
            );
            return $this->buildShareRuntimeAuthorization($projectId, $shareEntity->getOrganizationCode(), $currentAuthorization);
        }

        return $this->buildShareRuntimeAuthorization($projectId, $shareEntity->getOrganizationCode(), $currentAuthorization);
    }

    private function resolveProjectShare(int $projectId, string $shareToken): ResourceShareEntity
    {
        if (! AccessTokenUtil::validate($shareToken)) {
            $this->denyRuntimeAccess();
        }

        $shareId = AccessTokenUtil::getShareId($shareToken);
        if ($shareId === null) {
            $this->denyRuntimeAccess();
        }

        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
        // Existing tokens must stop working when a share is disabled. Unknown share
        // types must not fall through to the anonymous/public authorization branch.
        if ($shareEntity === null || ! $shareEntity->getIsEnabled()
            || ShareAccessType::tryFrom($shareEntity->getShareType()) === null) {
            $this->denyRuntimeAccess();
        }

        if ($shareEntity->getResourceType() !== ResourceType::Project->value || (int) $shareEntity->getProjectId() !== $projectId) {
            $this->denyRuntimeAccess();
        }

        return $shareEntity;
    }

    private function buildShareRuntimeAuthorization(
        int $projectId,
        string $dataOrganizationCode,
        ?MagicUserAuthorization $actorAuthorization
    ): MagicUserAuthorization {
        MagicBaseRuntimeProjectAccessContext::allowShareAccess(
            $projectId,
            $actorAuthorization?->getId() ?? '',
            $actorAuthorization?->getOrganizationCode() ?? ''
        );

        return (new MagicUserAuthorization())
            ->setId($actorAuthorization?->getId() ?? '')
            ->setOrganizationCode($dataOrganizationCode);
    }

    private function getOptionalCurrentAuthorization(): ?MagicUserAuthorization
    {
        $authorization = RequestCoContext::getUserAuthorization();
        if ($authorization instanceof MagicUserAuthorization && $authorization->getId() !== '') {
            return $authorization;
        }

        try {
            $authorization = $this->checkAndGetAuthorization();
            return $authorization instanceof MagicUserAuthorization ? $authorization : null;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return never
     */
    private function denyRuntimeAccess()
    {
        MagicBaseExceptionBuilder::accessDenied('magicbase.project_access_denied');
        throw new RuntimeException('Unreachable.');
    }
}
