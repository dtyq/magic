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
        // Get official organization code
        $officialOrgCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if (empty($officialOrgCode)) {
            echo "Warning: Official organization code not configured, skipping AI abilities initialization\n";
            return;
        }

        echo "Initializing SuperMagic AI abilities for organization: {$officialOrgCode}\n";

        try {
            // Prepare command parameters
            $command = 'ai-abilities:init';
            $params = [
                'command' => $command,
            ];

            // Create input and output
            $input = new ArrayInput($params);
            $output = new BufferedOutput();

            // Get application from container
            $container = ApplicationContext::getContainer();
            /** @var Application $application */
            $application = $container->get(ApplicationInterface::class);
            $application->setAutoExit(false);

            // Execute command
            $exitCode = $application->run($input, $output);

            // Output command result
            $outputContent = $output->fetch();
            echo $outputContent;

            if ($exitCode !== 0) {
                throw new RuntimeException("Command execution failed with exit code: {$exitCode}");
            }

            echo "SuperMagic AI abilities initialization completed successfully\n";
        } catch (Throwable $e) {
            echo 'Error initializing AI abilities: ' . $e->getMessage() . "\n";
            echo $e->getTraceAsString() . "\n";
            throw $e;
        }
    }

    public function down(): void
    {
        echo "Rollback: AI abilities are not deleted automatically\n";
        echo "If needed, please manually remove the following abilities:\n";
        echo "- image_remove_background\n";
        echo "- image_eraser\n";
        echo "- image_expand\n";
    }
};
