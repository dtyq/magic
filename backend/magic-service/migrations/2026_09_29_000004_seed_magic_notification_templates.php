<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    private const TEMPLATES = [
        [
            'type' => 'task_finished',
            'zh_title' => '任务执行成功',
            'zh_body' => '{{workspace_name}} / {{project_name}} 执行成功。',
            'en_title' => 'Task completed',
            'en_body' => '{{workspace_name}} / {{project_name}} completed successfully.',
        ],
        [
            'type' => 'task_failed',
            'zh_title' => '任务执行失败',
            'zh_body' => '{{workspace_name}} / {{project_name}} 执行失败，请重试。',
            'en_title' => 'Task failed',
            'en_body' => '{{workspace_name}} / {{project_name}} failed. Please try again.',
        ],
        [
            'type' => 'project_shared',
            'zh_title' => '收到团队分享 · 项目',
            'zh_body' => '{{sharer_name}} 向{{share_scope}}分享了项目「{{resource_name}}」。',
            'en_title' => 'Project shared with you',
            'en_body' => '{{sharer_name}} shared the project “{{resource_name}}” with {{share_scope}}.',
        ],
        [
            'type' => 'file_shared',
            'zh_title' => '收到团队分享 · 文件',
            'zh_body' => '{{sharer_name}} 向{{share_scope}}分享了文件「{{resource_name}}」。',
            'en_title' => 'File shared with you',
            'en_body' => '{{sharer_name}} shared the file “{{resource_name}}” with {{share_scope}}.',
        ],
        [
            'type' => 'skill_approved',
            'zh_title' => '技能审核通过',
            'zh_body' => '你的技能「{{resource_name}}」已审核通过。',
            'en_title' => 'Skill approved',
            'en_body' => 'Your skill “{{resource_name}}” has been approved.',
        ],
        [
            'type' => 'agent_approved',
            'zh_title' => '数字员工审核通过',
            'zh_body' => '你的数字员工「{{resource_name}}」已审核通过。',
            'en_title' => 'Digital employee approved',
            'en_body' => 'Your digital employee “{{resource_name}}” has been approved.',
        ],
    ];

    public function up(): void
    {
        $now = date('Y-m-d H:i:s');
        foreach (self::TEMPLATES as $template) {
            $this->insertIfMissing($template, 'zh-CN', $template['zh_title'], $template['zh_body'], $now);
            $this->insertIfMissing($template, 'en-US', $template['en_title'], $template['en_body'], $now);
        }
    }

    public function down(): void
    {
        Db::table('magic_notification_templates')
            ->whereIn('template_type', array_column(self::TEMPLATES, 'type'))
            ->where('version', 1)
            ->delete();
    }

    /**
     * @param array{type:string} $template
     */
    private function insertIfMissing(
        array $template,
        string $locale,
        string $title,
        string $body,
        string $now
    ): void {
        $exists = Db::table('magic_notification_templates')
            ->where('template_type', $template['type'])
            ->where('version', 1)
            ->where('locale', $locale)
            ->exists();

        if ($exists) {
            return;
        }

        Db::table('magic_notification_templates')->insert([
            'id' => IdGenerator::getSnowId(),
            'template_type' => $template['type'],
            'version' => 1,
            'locale' => $locale,
            'title_template' => $title,
            'body_template' => $body,
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
};
