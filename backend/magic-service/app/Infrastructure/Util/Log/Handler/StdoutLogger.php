<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Handler;

use Hyperf\Contract\StdoutLoggerInterface;
use Monolog\Level;
use Psr\Log\LogLevel;
use Stringable;
use Symfony\Component\Console\Output\ConsoleOutput;
use Symfony\Component\Console\Output\OutputInterface;

class StdoutLogger implements StdoutLoggerInterface
{
    private OutputInterface $output;

    private array $tags = [
        'component',
    ];

    public function __construct(
        ?OutputInterface $output = null,
        private readonly Level $minLevel = Level::Info,
    ) {
        $this->output = $output ?? new ConsoleOutput();
    }

    public function emergency($message, array $context = []): void
    {
        $this->log(Level::Emergency, $message, $context);
    }

    public function alert($message, array $context = []): void
    {
        $this->log(Level::Alert, $message, $context);
    }

    public function critical($message, array $context = []): void
    {
        $this->log(Level::Critical, $message, $context);
    }

    public function error($message, array $context = []): void
    {
        $this->log(Level::Error, $message, $context);
    }

    public function warning($message, array $context = []): void
    {
        $this->log(Level::Warning, $message, $context);
    }

    public function notice($message, array $context = []): void
    {
        $this->log(Level::Notice, $message, $context);
    }

    public function info($message, array $context = []): void
    {
        $this->log(Level::Info, $message, $context);
    }

    public function debug($message, array $context = []): void
    {
        $this->log(Level::Debug, $message, $context);
    }

    /**
     * @param Level $level
     * @param mixed $message
     */
    public function log($level, $message, array $context = []): void
    {
        if (! $this->minLevel->includes($level)) {
            return;
        }

        $tags = array_intersect_key($context, array_flip($this->tags));
        $context = array_diff_key($context, $tags);

        // Handle objects that are not Stringable
        foreach ($context as $key => $value) {
            if (is_object($value) && ! $value instanceof Stringable) {
                $context[$key] = '<OBJECT> ' . $value::class;
            }
        }

        $search = array_map(fn ($key) => sprintf('{%s}', $key), array_keys($context));
        $message = str_replace($search, $context, $this->getMessage((string) $message, $level->getName(), $tags));

        $this->output->writeln($message);
    }

    protected function getMessage(string $message, string $level = LogLevel::INFO, array $tags = []): string
    {
        $tag = match ($level) {
            LogLevel::EMERGENCY, LogLevel::ALERT, LogLevel::CRITICAL => 'error',
            LogLevel::ERROR => 'fg=red',
            LogLevel::WARNING, LogLevel::NOTICE => 'comment',
            default => 'info',
        };

        $template = sprintf('<%s>[%s]</>', $tag, strtoupper($level));
        $implodedTags = '';
        foreach ($tags as $value) {
            $implodedTags .= (' [' . $value . ']');
        }

        return sprintf($template . $implodedTags . ' %s', $message);
    }
}
