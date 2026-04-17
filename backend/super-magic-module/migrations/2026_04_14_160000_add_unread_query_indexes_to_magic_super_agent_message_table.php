<?php

declare(strict_types=1);

use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        Schema::table('magic_super_agent_message', static function (Blueprint $table) {
            if (! Schema::hasIndex('magic_super_agent_message', 'idx_topic_deleted_status_created_at')) {
                $table->index(
                    ['topic_id', 'deleted_at', 'status', 'created_at'],
                    'idx_topic_deleted_status_created_at'
                );
            }

            if (! Schema::hasIndex('magic_super_agent_message', 'idx_topic_deleted_status_id')) {
                $table->index(
                    ['topic_id', 'deleted_at', 'status', 'id'],
                    'idx_topic_deleted_status_id'
                );
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('magic_super_agent_message')) {
            return;
        }

        Schema::table('magic_super_agent_message', static function (Blueprint $table) {
            if (Schema::hasIndex('magic_super_agent_message', 'idx_topic_deleted_status_created_at')) {
                $table->dropIndex('idx_topic_deleted_status_created_at');
            }

            if (Schema::hasIndex('magic_super_agent_message', 'idx_topic_deleted_status_id')) {
                $table->dropIndex('idx_topic_deleted_status_id');
            }
        });
    }
};
