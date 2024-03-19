<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeRunnerBwrap;

use Hyperf\Support\Filesystem\FileNotFoundException;
use Hyperf\Support\Filesystem\Filesystem;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class Bubblewrap
{
    /**
     * @var array<string, mixed>
     */
    private array $config = [
        'network' => false,
        'env' => [
            'python' => [
                'PYTHONPATH' => '/code',
                'PYTHONUNBUFFERED' => '1',
            ],
            'php' => [
                'PHP_INI_SCAN_DIR' => '/dev/null', // 禁用额外ini配置
            ],
        ],
        'script_tpl_path' => '../resources/templates',
    ];

    /**
     * @var array<string, string>
     */
    private array $languageExt = [
        'python' => 'py',
        'php' => 'php',
    ];

    public function __construct(protected Filesystem $filesystem, array $config = [])
    {
        $this->config = array_replace_recursive($this->config, $config);
    }

    /**
     * @throws FileNotFoundException
     */
    public function run(array $request): array
    {
        if (empty($request['code'] ?? null)) {
            throw new \InvalidArgumentException('The code cannot be empty.');
        }

        // 创建临时目录
        $sandbox = $this->createSandbox($request);

        try {
            // 生成执行命令
            $command = $this->buildCommand($request['language'] ?? 'php', $sandbox);

            $process = new Process($command);
            $process->setTimeout(intval($request['timeout'] ?? 10));
            $process->setInput(json_encode($request['args'] ?? []));

            $start = microtime(true);
            $process->run();
            $executionTime = round(microtime(true) - $start, 4);

            if (! $process->isSuccessful()) {
                $message = empty($process->getErrorOutput()) ? $process->getOutput() : $process->getErrorOutput();
                throw new \RuntimeException($message, code: $process->getExitCode() ?? -1);
            }

            if (empty($output = json_decode($process->getOutput(), true))) {
                throw new \RuntimeException('No result was obtained');
            }

            $output['duration'] = intval($executionTime * 1000);

            return $output;
        } finally {
            $this->cleanup($sandbox);
        }
    }

    protected function formattingCode(string $code): string
    {
        // 添加代码缩进
        $lines = array_map(fn ($line) => "\t{$line}", explode("\n", trim($code)));
        return implode("\n", $lines);
    }

    private function createSandbox(array $request): array
    {
        $sandboxDir = sys_get_temp_dir() . '/' . uniqid('sandbox_');

        $this->filesystem->makeDirectory($sandboxDir);

        // 创建必要子目录
        $this->filesystem->makeDirectory("{$sandboxDir}/code");
        $this->filesystem->makeDirectory("{$sandboxDir}/tmp");
        $this->filesystem->makeDirectory("{$sandboxDir}/etc");

        $this->filesystem->put("{$sandboxDir}/etc/passwd", "nobody:x:65534:65534:nobody:/:/usr/sbin/nologin\n");
        $this->filesystem->put("{$sandboxDir}/etc/group", "nogroup:x:65534:\n");

        // 写入用户代码
        $ext = $this->languageExt[$request['language']] ?? '';
        $tplPath = "{$this->config['script_tpl_path']}/script.{$ext}";
        if (! $this->filesystem->exists($tplPath)) {
            throw new \RuntimeException('Template file not found');
        }

        $tpl = $this->filesystem->get($tplPath);
        $request['code'] = $this->formattingCode($request['code']);
        $code = str_replace('%{code}%', $request['code'], $tpl);
        $this->filesystem->put("{$sandboxDir}/code/script.{$ext}", $code);

        return [
            'dir' => $sandboxDir,
            'language' => $request['language'],
            'code_path' => "/code/script.{$ext}",
        ];
    }

    private function buildCommand(string $language, array $sandbox): array
    {
        $cmd = [
            'bwrap',
            '--tmpfs', '/tmp',
            '--ro-bind', '/usr', '/usr',
            '--ro-bind', '/opt', '/opt',
            '--ro-bind', '/lib', '/lib',
            '--ro-bind', '/lib64', '/lib64',
            '--ro-bind', $sandbox['dir'] . '/code', '/code',
            '--ro-bind', $sandbox['dir'] . '/etc', '/etc',
            '--chdir', '/code',
            '--unshare-all',
            '--die-with-parent',
            '--dev', '/dev',
            '--ro-bind', '/dev/null', '/dev/null',
            '--uid', '65534',
            '--gid', '65534',
        ];

        // 网络配置
        if ($this->config['network'] ?? false) {
            array_push($cmd, '--share-net', '--ro-bind', '/etc/resolv.conf', '/etc/resolv.conf');
        } else {
            $cmd[] = '--unshare-net';
        }

        $cmd = array_merge($cmd, $this->getEnvironments($language));
        return array_merge($cmd, $this->getRuntimeCommand($language, $sandbox));
    }

    private function getEnvironments(string $language): array
    {
        if (empty($env = $this->config['env'][$language] ?? [])) {
            return [];
        }

        $cmd = [];
        foreach ($env as $key => $value) {
            array_push($cmd, '--setenv', $key, $value);
        }

        return $cmd;
    }

    private function getRuntimeCommand(string $language, array $sandbox): array
    {
        $executableFinder = new ExecutableFinder();
        $languagePath = $executableFinder->find($language);

        return match ($language) {
            'python' => [$languagePath, '-u', $sandbox['code_path']],
            'php' => [$languagePath, '-n', $sandbox['code_path']],
            default => throw new \RuntimeException('Not supported language'),
        };
    }

    private function cleanup(array $sandbox): void
    {
        $this->filesystem->deleteDirectory($sandbox['dir']);
    }
}
