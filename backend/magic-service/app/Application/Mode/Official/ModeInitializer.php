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
     * @return array{success: bool, message: string, count: int}
     */
    public static function init(): array
    {
        // Check if magic_modes table already has data (excluding default mode)
        $existingCount = Db::table('magic_modes')
            ->where('identifier', '!=', 'default')
            ->count();

        if ($existingCount > 0) {
            return [
                'success' => true,
                'message' => "Magic modes table already has {$existingCount} custom modes, skipping initialization.",
                'count' => 0,
            ];
        }

        // Get official organization code from config
        $officialOrgCode = config('service_provider.office_organization', '');
        if (empty($officialOrgCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'count' => 0,
            ];
        }

        $modes = self::getModeData($officialOrgCode);
        $insertedCount = 0;

        try {
            Db::beginTransaction();

            foreach ($modes as $mode) {
                // Check if mode already exists
                $exists = Db::table('magic_modes')
                    ->where('id', $mode['id'])
                    ->exists();

                if (! $exists) {
                    Db::table('magic_modes')->insert($mode);
                    ++$insertedCount;
                }
            }

            Db::commit();

            return [
                'success' => true,
                'message' => "Successfully initialized {$insertedCount} modes.",
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
     * Get mode data.
     * @param string $orgCode Official organization code
     */
    private static function getModeData(string $orgCode): array
    {
        $now = now();
        $creatorId = 'system';

        return [
            // Chat Mode
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
                'distribution_type' => 1,
                'follow_mode_id' => 0,
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // PPT Mode
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
                'distribution_type' => 1,
                'follow_mode_id' => 0,
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // Data Analysis Mode
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
                'distribution_type' => 2, // Follow mode
                'follow_mode_id' => 821131542438486016,
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // Report Mode
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
                'status' => 0, // Disabled
                'distribution_type' => 2, // Follow mode
                'follow_mode_id' => 821131542438486016,
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // Recording Summary Mode
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
                'distribution_type' => 2, // Follow mode
                'follow_mode_id' => 821131542438486016,
                'restricted_mode_identifiers' => json_encode([]),
                'organization_code' => $orgCode,
                'creator_id' => $creatorId,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ],
            // General Mode
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
                'distribution_type' => 2, // Follow mode
                'follow_mode_id' => 821131542438486016,
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
