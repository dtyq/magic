<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ApplicationInterface;
use Hyperf\Database\Migrations\Migration;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

return new class extends Migration {
    public function up(): void
    {
        $officialOrgCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if (empty($officialOrgCode)) {
            echo "Warning: Official organization code not configured, skipping AI abilities initialization\n";
            return;
        }

        echo "Initializing knowledge base visual understanding AI ability for organization: {$officialOrgCode}\n";

        try {
            $input = new ArrayInput([
                'command' => 'ai-abilities:init',
            ]);
            $output = new BufferedOutput();

            $container = ApplicationContext::getContainer();
            /** @var Application $application */
            $application = $container->get(ApplicationInterface::class);
            $application->setAutoExit(false);

            $exitCode = $application->run($input, $output);

            echo $output->fetch();

            if ($exitCode !== 0) {
                throw new RuntimeException("Command execution failed with exit code: {$exitCode}");
            }

            echo "Knowledge base visual understanding AI ability initialization completed successfully\n";
        } catch (Throwable $e) {
            echo 'Error initializing knowledge base visual understanding AI ability: ' . $e->getMessage() . "\n";
            echo $e->getTraceAsString() . "\n";
            throw $e;
        }
    }

    public function down(): void
    {
        echo "Rollback: AI ability rows are not deleted automatically\n";
        echo "If needed, please manually remove or disable knowledge_base_visual_understanding in admin.\n";
    }
};
