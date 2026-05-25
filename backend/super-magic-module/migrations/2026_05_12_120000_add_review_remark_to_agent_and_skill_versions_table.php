<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddReviewRemarkToAgentAndSkillVersionsTable extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('magic_super_magic_agent_versions')
            && ! Schema::hasColumn('magic_super_magic_agent_versions', 'review_remark')) {
            Schema::table('magic_super_magic_agent_versions', static function (Blueprint $table) {
                $table->text('review_remark')->nullable()->after('review_status')->comment('审核说明，同意/拒绝均可为空');
            });
        }

        if (Schema::hasTable('magic_skill_versions')
            && ! Schema::hasColumn('magic_skill_versions', 'review_remark')) {
            Schema::table('magic_skill_versions', static function (Blueprint $table) {
                $table->text('review_remark')->nullable()->after('review_status')->comment('审核说明，同意/拒绝均可为空');
            });
        }
    }

    public function down(): void
    {
    }
}
