<?php

declare(strict_types=1);

use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddShowInUiToMagicSuperAgentMessageTable extends Migration
{
    public function up(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            $table->tinyInteger('show_in_ui')->default(1)->comment('是否在UI中显示，1是，0否');
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            $table->dropColumn('show_in_ui');
        });
    }
} 