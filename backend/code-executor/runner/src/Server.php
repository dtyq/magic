<?php

declare(strict_types=1);

/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeRunnerBwrap;

use Hyperf\Support\Filesystem\FileNotFoundException;
use Hyperf\Support\Filesystem\Filesystem;
use Swoole\Http\Response;
use Swoole\Http\Server as SwooleServer;
use Symfony\Component\Process\Exception\ProcessSignaledException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;

class Server
{
    protected SwooleServer $server;

    protected int $port;

    protected Bubblewrap $bubblewrap;

    protected array $options;

    public function __construct(string $host = '0.0.0.0', int $port = 9000, ?Filesystem $filesystem = null, array $options = [], $runtimeOptions = [])
    {
        $this->port = $port;
        $this->options = $options;
        $this->server = new SwooleServer($host, $port);
        $this->bubblewrap = new Bubblewrap($filesystem ?? new Filesystem(), $runtimeOptions);
    }

    public function run(): void
    {
        $this->server->set($this->options);

        $this->registerEvents();

        $this->server->start();
    }

    public function handleTask($serv, $task_id, $worker_id, $data): void
    {
        if (empty($data = json_decode($data, true))) {
            throw new \RuntimeException('The task data must be in JSON format');
        }

        $response = Response::create($data['fd']);

        $func = function () use ($data) {
            try {
                if (empty($payload = json_decode($data['payload'], true))) {
                    throw new \RuntimeException('The request body must be in JSON format');
                }

                if (empty($payload['code'] ?? null)) {
                    throw new \InvalidArgumentException('The code cannot be empty');
                }

                return $this->executeCode($payload);
            } catch (\Throwable $e) {
                if ($e instanceof ProcessTimedOutException || ($e instanceof ProcessSignaledException && $e->getSignal() == Signal::KILL->value)) {
                    return error(
                        StatusCode::EXECUTE_TIMEOUT,
                        "The code execution time exceeded the timeout of {$e->getExceededTimeout()} seconds"
                    );
                }
                return error(StatusCode::tryFrom($e->getCode()) ?? StatusCode::EXECUTE_FAILED, $e->getMessage());
            }
        };

        $response->end($func());
    }

    protected function registerEvents(): void
    {
        $this->server->on('start', function () {
            echo 'Swoole http server is started at http://0.0.0.0:' . $this->port . PHP_EOL;
        });

        $this->server->on('shutdown', function () {
            echo 'Swoole http server shutdown' . PHP_EOL;
        });

        $this->server->on('request', function ($request, $response) {
            echo 'Raw Content: ' . $request->rawContent() . PHP_EOL;

            $response->detach();
            $this->server->task(json_encode([
                'fd' => strval($response->fd),
                'payload' => $request->rawContent(),
            ]));
        });

        $this->server->on('task', [$this, 'handleTask']);
    }

    /**
     * @throws FileNotFoundException
     */
    protected function executeCode(array $payload): string
    {
        return success($this->bubblewrap->run($payload));
    }
}
