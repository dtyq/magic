<?php

use Hyperf\Database\Schema\Schema;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_workspace_versions', function (Blueprint $table) {
            $table->integer('tag')->default(0)->comment("版本号");
            $table->bigInteger('project_id')->default(0)->comment("项目id");
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

    }
};
