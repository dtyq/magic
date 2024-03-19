<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\AdminModeAssembler;
use App\Application\Mode\DTO\Admin\AdminModeDTO;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Exception;

/**
 * MCP 专用的模式管理应用服务
 * 使用 ModeEntity 作为参数，避免依赖 FormRequest.
 */
class AdminModeMCPAppService extends AbstractModeAppService
{
    /**
     * 系统内置模式标识（不允许修改）.
     */
    private const array SYSTEM_MODE_IDENTIFIERS = [
        'general',
        'chat',
        'ppt',
        'summary',
        'data_analysis',
        'design',
    ];

    /**
     * 获取模式列表.
     */
    public function getModes(MagicUserAuthorization $authorization, Page $page): array
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);
        $query = new ModeQuery('desc', false);
        $result = $this->modeDomainService->getModes($dataIsolation, $query, $page);

        $modeDTOs = AdminModeAssembler::entitiesToAdminDTOs($result['list']);

        return [
            'total' => $result['total'],
            'list' => $modeDTOs,
        ];
    }

    /**
     * 创建模式.
     */
    public function createMode(MagicUserAuthorization $authorization, ModeEntity $modeEntity): AdminModeDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        try {
            $savedMode = $this->modeDomainService->createMode($dataIsolation, $modeEntity);
            return AdminModeAssembler::modeToAdminDTO($savedMode);
        } catch (Exception $exception) {
            $this->logger->warning('CreateModeFailed', [
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }
    }

    /**
     * 更新模式.
     */
    public function updateMode(MagicUserAuthorization $authorization, string $id, ModeEntity $savingMode): AdminModeDTO
    {
        $dataIsolation = $this->getModeDataIsolation($authorization);

        try {
            // 先查询现有的模式
            $existingMode = $this->modeDomainService->getModeById($dataIsolation, (int) $id);

            // 检查是否为系统内置模式，不允许修改
            if (in_array($existingMode->getIdentifier(), self::SYSTEM_MODE_IDENTIFIERS, true)) {
                ExceptionBuilder::throw(ModeErrorCode::SYSTEM_MODE_CANNOT_BE_MODIFIED);
            }

            // 使用 savingMode 中的值更新现有模式
            $existingMode->setNameI18n($savingMode->getNameI18n());
            $existingMode->setIdentifier($savingMode->getIdentifier());
            $existingMode->setPlaceholderI18n($savingMode->getPlaceholderI18n());
            $existingMode->setSort($savingMode->getSort());

            // 如果有组织白名单，则更新
            $visibilityWhitelist = $savingMode->getVisibilityWhitelist();
            if (! empty($visibilityWhitelist)) {
                $existingMode->setVisibilityWhitelist($visibilityWhitelist);
            }

            // 保存更新
            $savedMode = $this->modeDomainService->updateMode($dataIsolation, $existingMode);
            return AdminModeAssembler::modeToAdminDTO($savedMode);
        } catch (Exception $exception) {
            $this->logger->warning('UpdateModeFailed', [
                'id' => $id,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }
    }
}
