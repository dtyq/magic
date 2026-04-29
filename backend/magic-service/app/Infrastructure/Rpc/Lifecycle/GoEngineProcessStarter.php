<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

class GoEngineProcessStarter
{
    public function start(GoEngineStartRequest $request): ?GoEngineStartHandle
    {
        $processSpec = $request->processSpec;
        $pipes = [];
        $process = proc_open(
            $processSpec->commandVector(),
            [
                0 => ['pipe', 'r'],
                1 => ['file', 'php://stdout', 'w'],
                2 => ['file', 'php://stderr', 'w'],
            ],
            $pipes,
            $processSpec->workDir,
            $this->buildEnvironment($processSpec)
        );

        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }

        if (! is_resource($process)) {
            return null;
        }

        return new GoEngineStartHandle($process, $request);
    }

    /**
     * @return array<string, string>
     */
    private function buildEnvironment(GoEngineProcessSpec $processSpec): array
    {
        $currentEnvironment = getenv();
        if (! is_array($currentEnvironment)) {
            $currentEnvironment = [];
        }

        /** @var array<string, string> $environment */
        $environment = $currentEnvironment;

        return array_merge($environment, $processSpec->environment, [
            'PWD' => $processSpec->workDir,
        ]);
    }
}
