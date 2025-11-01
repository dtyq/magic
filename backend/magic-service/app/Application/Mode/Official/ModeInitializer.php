<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Official;

use Hyperf\DbConnection\Db;
use Throwable;

use function Hyperf\Support\now;

/**
 * Official Mode Initializer.
 * Initialize default modes for new system setup.
 */
class ModeInitializer
{
    /**
     * Initialize official modes.
     * Strategy: Check first, then operate (for default mode).
     * - If default mode exists, use its real ID
     * - If not, insert with hardcoded ID
     * - Other modes use the real default mode ID for follow_mode_id.
     * @return array{success: bool, message: string, count: int}
     */
    public static function init(): array
    {
        // Get official organization code from config
        $officialOrgCode = config('service_provider.office_organization', '');
        if (empty($officialOrgCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'count' => 0,
            ];
        }

        try {
            Db::beginTransaction();

            $insertedCount = 0;

            // Step 1: Check if default mode exists for this organization, get its real ID
            $defaultMode = Db::table('magic_modes')
                ->where('identifier', 'default')
                ->first();

            if ($defaultMode) {
                // Default mode exists, use its real ID
                $defaultModeId = $defaultMode['id'];
            } else {
                // Default mode not exists, insert with hardcoded ID
                $defaultModeData = self::getDefaultModeData($officialOrgCode);
                $defaultModeId = Db::table('magic_modes')->insertGetId($defaultModeData);
                ++$insertedCount;
            }

            // Step 2: Get other modes with real default mode ID
            $modes = self::getOtherModesData($officialOrgCode, $defaultModeId);

            // Step 3: Insert other modes if not exist
            foreach ($modes as $mode) {
                $exists = Db::table('magic_modes')
                    ->where('identifier', $mode['identifier'])
                    ->where('organization_code', $officialOrgCode)
                    ->exists();

                if (! $exists) {
                    Db::table('magic_modes')->insert($mode);
                    ++$insertedCount;
                }
            }

            // Step 4: Initialize default mode groups and models if not exist
            $defaultGroupExists = Db::table('magic_mode_groups')
                ->where('mode_id', $defaultModeId)
                ->where('organization_code', $officialOrgCode)
                ->exists();

            if (! $defaultGroupExists) {
                // Create basic model configuration for default mode
                $modelCount = self::initializeDefaultModeModels($defaultModeId, $officialOrgCode);
                $insertedCount += $modelCount;
            }

            Db::commit();

            return [
                'success' => true,
                'message' => "Successfully initialized {$insertedCount} modes (default_mode_id: {$defaultModeId}).",
                'count' => $insertedCount,
            ];
        } catch (Throwable $e) {
            Db::rollBack();
            return [
                'success' => false,
                'message' => 'Failed to initialize modes: ' . $e->getMessage(),
                'count' => 0,
            ];
        }
    }

    /**
     * Initialize basic model configuration for default mode.
     * Strategy: Check first, then insert (idempotent).
     * This allows follow modes to inherit the configuration.
     * @param int|string $defaultModeId Default mode ID
     * @param string $orgCode Organization code
     * @return int Number of items created (group + relations)
     */
    private static function initializeDefaultModeModels(int|string $defaultModeId, string $orgCode): int
    {
        $count = 0;
        $now = now();

        // Step 1: Query available models for the organization
        $availableModels = Db::table('service_provider_models')
            ->whereIn('organization_code', [$orgCode, 'TGosRaFhvb'])
            ->where('status', '1')
            ->whereIn('model_id', ['gpt-4o', 'gpt-4o-mini', 'auto', 'claude-3.7', 'deepseek-chat'])
            ->orderBy('model_id')
            ->limit(10)
            ->get(['id', 'model_id', 'name']);

        if ($availableModels->isEmpty()) {
            // No available models, skip initialization
            return 0;
        }

        // Step 2: Check if default group exists, if not create it
        $existingGroup = Db::table('magic_mode_groups')
            ->where('mode_id', $defaultModeId)
            ->where('organization_code', $orgCode)
            ->orderBy('sort', 'desc')
            ->first();

        if ($existingGroup) {
            // Group exists, use existing group ID
            $groupId = $existingGroup->id;
        } else {
            // Group does not exist, create default group
            $groupId = Db::table('magic_mode_groups')->insertGetId([
                'mode_id' => $defaultModeId,
                'name_i18n' => json_encode([
                    'en_US' => 'Default Group-1',
                    'zh_CN' => '默认分组-1',
                ]),
                'icon' => 'IconBrain',
                'description' => '',
                'sort' => 1,
                'status' => 1,
                'organization_code' => $orgCode,
                'creator_id' => 'system',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            ++$count;
        }

        // Step 3: Add models to the group (check first, then insert)
        $sort = 0;
        foreach ($availableModels as $model) {
            // Support both array and object access
            $modelId = $model['model_id'];
            $providerId = $model['id'];

            // Check if model relation already exists
            $relationExists = Db::table('magic_mode_group_relations')
                ->where('mode_id', $defaultModeId)
                ->where('group_id', $groupId)
                ->where('model_id', $modelId)
                ->where('organization_code', $orgCode)
                ->exists();

            if (! $relationExists) {
                // Model relation does not exist, insert it
                Db::table('magic_mode_group_relations')->insert([
                    'mode_id' => $defaultModeId,
                    'group_id' => $groupId,
                    'model_id' => $modelId,
                    'provider_model_id' => $providerId,
                    'sort' => $sort,
                    'organization_code' => $orgCode,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                ++$count;
            }
        }

        return $count;
    }

    /**
     * Get default mode data with hardcoded ID.
     * This is the base mode that other modes will follow.
     * @param string $orgCode Official organization code
     */
    private static function getDefaultModeData(string $orgCode): array
    {
        $now = now();
        $creatorId = 'system';

        return [
            'id' => '842103554687242240', // Hardcoded ID (preferred)
            'name_i18n' => json_encode([
                'en_US' => 'Default Mode',
                'zh_CN' => '默认模式',
            ]),
            'placeholder_i18n' => json_encode([]),
            'identifier' => 'default',
            'icon' => 'Icon3dCubeSphere',
            'color' => '#999999',
            'sort' => 0,
            'description' => '仅用于创建时初始化模式及重置模式中的配置',
            'is_default' => 1,
            'status' => 1,
            'distribution_type' => 1,
            'follow_mode_id' => 0,
            'restricted_mode_identifiers' => json_encode([]),
            'organization_code' => $orgCode,
            'creator_id' => $creatorId,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
        ];
    }

    /**
     * Get other modes data with real default mode ID.
     * All follow modes use the real default mode ID from database.
     * @param string $orgCode Official organization code
     * @param int|string $defaultModeId Real default mode ID from database
     */
    private static function getOtherModesData(string $orgCode, int|string $defaultModeId): array
    {
        $now = now();
        $creatorId = 'system';

        return [
            // Chat Mode (follows default mode)
            [
                'id' => '821132008052400129',
                'name_i18n' => json_encode([
                    'en_US' => 'Chat',
                    'zh_CN' => '聊天模式',
                ]),
                'placeholder_i18n' => json_encode([
                    'en_US' => 'Please enter the content to converse with the agent.',
                    'zh_CN' => '请输入与智能体对话的内容',
                ]),
                'identifier' => 'chat',
                'icon' => 'IconMessages',
                'color' => '#00A8FF',
                'sort' => 100,
                'description' => '',
                'is_default' => 0,
                'status' => 1,
                'distribution_type' => 2,
                'follow_mode_id' => $defaultModeId, // Use real default mode ID
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // PPT Mode (follows default mode)
            [
                'id' => '821139004944207873',
                'name_i18n' => json_encode([
                    'en_US' => 'Silde',
                    'zh_CN' => 'PPT 模式',
                ]),
                'placeholder_i18n' => json_encode([
                    'en_US' => 'You can enter the theme and specific requirements of the PPT, or upload files, Super Magic will help you create a beautiful PPT. Enter to send; Shift + Enter to line break',
                    'zh_CN' => '您可输入 PPT 的主题和具体要求，或上传文件，超级麦吉将为您制作精美的 PPT。 Enter 发送 ; Shift + Enter 换行',
                ]),
                'identifier' => 'ppt',
                'icon' => 'IconPresentation',
                'color' => '#FF7D00',
                'sort' => 98,
                'description' => '',
                'is_default' => 0,
                'status' => 1,
                'distribution_type' => 2,
                'follow_mode_id' => $defaultModeId, // Use real default mode ID
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // Data Analysis Mode (follows default mode)
            [
                'id' => '821139625302740993',
                'name_i18n' => json_encode([
                    'en_US' => 'Analysis',
                    'zh_CN' => '数据分析',
                ]),
                'placeholder_i18n' => json_encode([
                    'en_US' => 'You can select data sources or upload Excel files, and then enter the requirements for analysis. Super Magic will perform comprehensive data analysis for you. Enter to send; Shift + Enter to line break',
                    'zh_CN' => '您可选择数据源或上传 Excel 文件后，输入需要分析的需求，超级麦吉将为您进行全面的数据分析。 Enter 发送 ; Shift + Enter 换行',
                ]),
                'identifier' => 'data_analysis',
                'icon' => 'IconChartBarPopular',
                'color' => '#32C436',
                'sort' => 99,
                'description' => '',
                'is_default' => 0,
                'status' => 1,
                'distribution_type' => 2,
                'follow_mode_id' => $defaultModeId, // Use real default mode ID
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // Report Mode (follows default mode, disabled by default)
            [
                'id' => '821139708794552321',
                'name_i18n' => json_encode([
                    'en_US' => 'Report Mode',
                    'zh_CN' => '研报模式',
                ]),
                'placeholder_i18n' => json_encode([
                    'en_US' => 'You can enter the theme and specific requirements of your research report, or upload a file, and Super Maggie will write a complete and detailed report for you. Press Enter to send; press Shift + Enter to wrap lines.',
                    'zh_CN' => '您可输入研究报告的主题和具体需求，或上传文件，超级麦吉将为您进行完整且详细的报告撰写。 Enter 发送 ; Shift + Enter 换行',
                ]),
                'identifier' => 'report',
                'icon' => 'IconMicroscope',
                'color' => '#00BF9A',
                'sort' => 96,
                'description' => '',
                'is_default' => 0,
                'status' => 0,
                'distribution_type' => 2,
                'follow_mode_id' => $defaultModeId, // Use real default mode ID
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // Recording Summary Mode (follows default mode)
            [
                'id' => '821139797042712577',
                'name_i18n' => json_encode([
                    'en_US' => 'Record',
                    'zh_CN' => '录音总结',
                ]),
                'placeholder_i18n' => json_encode([
                    'en_US' => 'You can enter the text content of the meeting, or upload meeting audio files, Super Magic will help you complete the meeting summary. Enter to send; Shift + Enter to line break',
                    'zh_CN' => '您可输入会议的文字内容，或上传会议录音文件，超级麦吉将为您进行完整的会议总结。 Enter 发送 ; Shift + Enter 换行',
                ]),
                'identifier' => 'summary',
                'icon' => 'IconFileDescription',
                'color' => '#7E57EA',
                'sort' => 97,
                'description' => '',
                'is_default' => 0,
                'status' => 1,
                'distribution_type' => 2,
                'follow_mode_id' => $defaultModeId, // Use real default mode ID
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // General Mode (follows default mode)
            [
                'id' => '821139958364049409',
                'name_i18n' => json_encode([
                    'en_US' => 'General',
                    'zh_CN' => '通用模式',
                ]),
                'placeholder_i18n' => json_encode([
                    'en_US' => 'You can enter the text content of the meeting, or upload meeting audio files, Super Magic will help you complete the meeting summary. Enter to send; Shift + Enter to line break',
                    'zh_CN' => '请输入您的需求，或上传文件，超级麦吉将为您解决问题。 Enter 发送 ; Shift + Enter 换行',
                ]),
                'identifier' => 'general',
                'icon' => 'IconSuperMagic',
                'color' => '#315CEC',
                'sort' => 10000,
                'description' => '',
                'is_default' => 0,
                'status' => 1,
                'distribution_type' => 2,
                'follow_mode_id' => $defaultModeId, // Use real default mode ID
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
        ];
    }
}
