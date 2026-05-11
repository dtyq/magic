<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Application\Skill\Initializer\BuiltinSkillInitializer;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;

/*
 * 初始化系统内置技能
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_skills')
            || ! Schema::hasTable('magic_skill_versions')
            || ! Schema::hasTable('magic_skill_market')) {
            return;
        }

        $result = BuiltinSkillInitializer::init();
        if (! $result['success']) {
            throw new RuntimeException($result['message']);
        }
    }

    public function down(): void
    {
    }
};
