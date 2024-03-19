<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Facade\AppMenu;

use App\Application\AppMenu\Service\AppMenuAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Domain\AppMenu\Entity\AppMenuEntity;
use App\Domain\AppMenu\Entity\ValueObject\DisplayScope;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Admin\Assembler\AppMenu\AppMenuAssembler;
use App\Interfaces\Admin\DTO\AppMenu\AppMenuDTO;
use App\Interfaces\Admin\Request\AppMenu\AppMenuSaveRequest;
use App\Interfaces\Admin\Request\AppMenu\AppMenuStatusRequest;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class AppMenuAdminApi extends AbstractApi
{
    #[Inject]
    protected AppMenuAppService $appMenuAppService;

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_APPLICATION, MagicOperationEnum::QUERY)]
    public function queries()
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();
        $displayScopeRaw = $this->request->input('display_scope');
        $displayScope = null;
        if ($displayScopeRaw !== null && $displayScopeRaw !== '') {
            $scope = DisplayScope::tryFrom((int) $displayScopeRaw);
            if ($scope !== null) {
                $displayScope = $scope->value;
            }
        }

        $filters = [
            'name' => (string) $this->request->input('name', ''),
            'display_scope' => $displayScope,
        ];

        $result = $this->appMenuAppService->queries($authorization, $filters, $page);

        return AppMenuAssembler::createPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: $page,
            icons: $result['icons'],
        );
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_APPLICATION, MagicOperationEnum::QUERY)]
    public function show(string $id)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->appMenuAppService->show($authorization, self::parseId($id));

        return $this->createResponseDTO($authorization, $entity);
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_APPLICATION, MagicOperationEnum::EDIT)]
    public function save(AppMenuSaveRequest $request)
    {
        $authorization = $this->getAuthorization();
        $payload = $request->validated();

        if (array_key_exists('id', $payload)) {
            $idRaw = $payload['id'];
            if ($idRaw !== null && $idRaw !== '') {
                $payload['id'] = (string) self::parseId(is_scalar($idRaw) ? (string) $idRaw : null);
            } else {
                unset($payload['id']);
            }
        }

        $dto = new AppMenuDTO($payload);
        $entity = AppMenuAssembler::createEntity($dto);
        $savedEntity = $this->appMenuAppService->save($authorization, $entity);

        return $this->createResponseDTO($authorization, $savedEntity);
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_APPLICATION, MagicOperationEnum::EDIT)]
    public function delete()
    {
        $authorization = $this->getAuthorization();
        $id = $this->request->input('id');

        return $this->appMenuAppService->delete(
            $authorization,
            self::parseId(is_int($id) || is_string($id) ? $id : null)
        );
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SETTING_APPLICATION, MagicOperationEnum::EDIT)]
    public function status(AppMenuStatusRequest $request)
    {
        $authorization = $this->getAuthorization();
        $payload = $request->validated();
        $id = self::parseId($payload['id'] ?? '');
        $status = (int) $payload['status'];

        $entity = $this->appMenuAppService->updateStatus($authorization, $id, $status);

        return $this->createResponseDTO($authorization, $entity);
    }

    private function createResponseDTO(MagicUserAuthorization $authorization, AppMenuEntity $entity): AppMenuDTO
    {
        $organizationCode = $authorization->getOrganizationCode();
        $users = $this->appMenuAppService->getUsers($organizationCode, [$entity->getCreatorId()]);
        $icons = [];
        if ($entity->isImageIcon() && $entity->getIconUrl() !== '') {
            $icons = $this->appMenuAppService->getIcons($organizationCode, [$entity->getIconUrl()]);
        }

        return AppMenuAssembler::createDTO($entity, $users, $icons);
    }

    private static function parseId(null|int|string $id): int
    {
        if ($id === null || $id === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.empty', ['label' => '应用ID']);
        }

        $id = (string) $id;
        if (! ctype_digit($id)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '应用ID']);
        }

        return (int) $id;
    }
}
