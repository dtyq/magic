<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Mode\Service\AdminModeAppService;
use App\Application\Mode\Service\AdminModeMCPAppService;
use App\Domain\Mode\Entity\DistributionTypeEnum;
use App\Domain\Mode\Entity\ModeEntity;
use App\Infrastructure\Core\AbstractMCP;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\PhpMcp\Server\Framework\Hyperf\Collector\Annotations\McpTool;

class AdminModeMCP extends AbstractMCP
{
    /**
     * 获取模式列表.
     */
    #[McpTool(
        name: 'get_modes',
        description: '获取模式列表',
        inputSchema: [
            'type' => 'object',
            'properties' => [
                'page' => [
                    'type' => 'integer',
                    'description' => '页码, 默认1',
                    'default' => 1,
                ],
                'page_size' => [
                    'type' => 'integer',
                    'description' => '每页数量, 默认20',
                    'default' => 20,
                ],
            ],
            'required' => [],
        ],
        server: 'admin_mode',
        version: '1.0.0'
    )]
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODE], MagicOperationEnum::QUERY)]
    public static function getModes(array $args = []): array
    {
        $page = $args['page'] ?? 1;
        $page_size = $args['page_size'] ?? 20;
        $authorization = RequestCoContext::getUserAuthorization();
        return di(AdminModeMCPAppService::class)->getModes($authorization, new Page($page, $page_size));
    }

    /**
     * 创建模式.
     */
    #[McpTool(
        name: 'create_mode',
        description: '创建新的AI模式',
        inputSchema: [
            'type' => 'object',
            'properties' => [
                'name_i18n' => [
                    'type' => 'object',
                    'description' => '模式名称（多语言）',
                    'properties' => [
                        'zh_CN' => [
                            'type' => 'string',
                            'description' => '中文名称',
                            'maxLength' => 100,
                        ],
                        'en_US' => [
                            'type' => 'string',
                            'description' => '英文名称',
                            'maxLength' => 100,
                        ],
                    ],
                    'required' => ['zh_CN', 'en_US'],
                ],
                'identifier' => [
                    'type' => 'string',
                    'description' => '模式标识，必须与无敌麦吉模式的唯一标识一致',
                    'maxLength' => 50,
                ],
                'placeholder_i18n' => [
                    'type' => 'object',
                    'description' => '占位文本（多语言），用于设置输入框中的Placeholder，内容支持换行',
                    'properties' => [
                        'zh_CN' => [
                            'type' => 'string',
                            'description' => '中文占位文本',
                            'maxLength' => 500,
                        ],
                        'en_US' => [
                            'type' => 'string',
                            'description' => '英文占位文本',
                            'maxLength' => 500,
                        ],
                    ],
                ],
                'sort' => [
                    'type' => 'integer',
                    'description' => '展示优先级，数值越大，优先级越高',
                    'default' => 0,
                ],
                'organization_whitelist' => [
                    'type' => 'array',
                    'description' => '组织白名单（输入组织ID，多个组织ID用逗号分隔），设置白名单后，该模式仅适用于白名单组织，非白名单组织不可见',
                    'items' => [
                        'type' => 'string',
                    ],
                ],
            ],
            'required' => ['name_i18n', 'identifier'],
        ],
        server: 'admin_mode',
        version: '1.0.0'
    )]
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODE], MagicOperationEnum::EDIT)]
    public static function createMode(array $args = []): array
    {
        $authorization = RequestCoContext::getUserAuthorization();

        // 构建 ModeEntity
        $modeEntity = self::buildModeEntity($args);

        // 创建模式时默认为禁用状态
        $modeEntity->setStatus(false);

        // 获取默认模式，设置 "分配模型" 跟随模式
        $defaultMode = di(AdminModeAppService::class)->getDefaultMode($authorization);
        if ($defaultMode) {
            $modeEntity->setDistributionType(DistributionTypeEnum::INHERITED);
            $modeEntity->setFollowModeId($defaultMode->getMode()->getId());
        }

        // 调用 MCP 专用应用服务
        $modeDTO = di(AdminModeMCPAppService::class)->createMode($authorization, $modeEntity);

        return $modeDTO->toArray();
    }

    /**
     * 更新模式.
     */
    #[McpTool(
        name: 'update_mode',
        description: '更新AI模式',
        inputSchema: [
            'type' => 'object',
            'properties' => [
                'id' => [
                    'type' => 'string',
                    'description' => '模式ID',
                ],
                'name_i18n' => [
                    'type' => 'object',
                    'description' => '模式名称（多语言）',
                    'properties' => [
                        'zh_CN' => [
                            'type' => 'string',
                            'description' => '中文名称',
                            'maxLength' => 100,
                        ],
                        'en_US' => [
                            'type' => 'string',
                            'description' => '英文名称',
                            'maxLength' => 100,
                        ],
                    ],
                    'required' => ['zh_CN', 'en_US'],
                ],
                'identifier' => [
                    'type' => 'string',
                    'description' => '模式标识，必须与无敌麦吉模式的唯一标识一致',
                    'maxLength' => 50,
                ],
                'placeholder_i18n' => [
                    'type' => 'object',
                    'description' => '占位文本（多语言），用于设置输入框中的Placeholder，内容支持换行',
                    'properties' => [
                        'zh_CN' => [
                            'type' => 'string',
                            'description' => '中文占位文本',
                            'maxLength' => 500,
                        ],
                        'en_US' => [
                            'type' => 'string',
                            'description' => '英文占位文本',
                            'maxLength' => 500,
                        ],
                    ],
                ],
                'sort' => [
                    'type' => 'integer',
                    'description' => '展示优先级，数值越大，优先级越高',
                    'default' => 0,
                ],
                'organization_whitelist' => [
                    'type' => 'array',
                    'description' => '组织白名单（输入组织ID，多个组织ID用逗号分隔），设置白名单后，该模式仅适用于白名单组织，非白名单组织不可见',
                    'items' => [
                        'type' => 'string',
                    ],
                ],
            ],
            'required' => ['id', 'name_i18n', 'identifier'],
        ],
        server: 'admin_mode',
        version: '1.0.0'
    )]
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODE], MagicOperationEnum::EDIT)]
    public static function updateMode(array $args = []): array
    {
        $authorization = RequestCoContext::getUserAuthorization();

        // 构建更新用的 ModeEntity（不设置默认值）
        $savingMode = self::buildModeEntityForUpdate($args);

        // 调用 MCP 专用应用服务
        $modeDTO = di(AdminModeMCPAppService::class)->updateMode($authorization, $args['id'], $savingMode);

        return $modeDTO->toArray();
    }

    /**
     * 构建 ModeEntity（创建时使用，包含默认值）.
     */
    private static function buildModeEntity(array $args): ModeEntity
    {
        $modeEntity = new ModeEntity();
        $modeEntity->setNameI18n($args['name_i18n']);
        $modeEntity->setIdentifier($args['identifier']);

        // 设置默认值
        $modeEntity->setIcon('IconSuperMagic');
        $modeEntity->setIconType(1);
        $modeEntity->setColor('#32C436');
        $modeEntity->setSort($args['sort'] ?? 0);
        $modeEntity->setDescription('');

        if (isset($args['placeholder_i18n'])) {
            $modeEntity->setPlaceholderI18n($args['placeholder_i18n']);
        }
        if (isset($args['organization_whitelist'])) {
            $modeEntity->setVisibilityWhitelist([
                'organizations' => $args['organization_whitelist'],
            ]);
        }

        return $modeEntity;
    }

    /**
     * 构建更新用的 ModeEntity（不设置默认值，只包含要更新的字段）.
     */
    private static function buildModeEntityForUpdate(array $args): ModeEntity
    {
        $modeEntity = new ModeEntity();
        $modeEntity->setNameI18n($args['name_i18n']);
        $modeEntity->setIdentifier($args['identifier']);
        $modeEntity->setSort($args['sort'] ?? 0);

        if (isset($args['placeholder_i18n'])) {
            $modeEntity->setPlaceholderI18n($args['placeholder_i18n']);
        }
        if (isset($args['organization_whitelist'])) {
            $modeEntity->setVisibilityWhitelist([
                'organizations' => $args['organization_whitelist'],
            ]);
        }

        return $modeEntity;
    }
}
