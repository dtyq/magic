<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Handler;

use App\Infrastructure\Util\Log\Output\FastStdoutOutput;
use Hyperf\Contract\StdoutLoggerInterface;
use Monolog\Level;
use Stringable;
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
        $this->output = $output ?? new FastStdoutOutput();
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

        // Fast direct message formatting - avoid expensive string operations
        $levelName = strtoupper($level->getName());
        $formattedMessage = $this->buildMessage((string) $message, $levelName, $tags, $context);

        $this->output->writeln($formattedMessage);
    }

    /**
     * Optimized message building - avoids expensive sprintf and str_replace operations.
     */
    private function buildMessage(string $message, string $levelName, array $tags, array $context): string
    {
        // Determine color tag based on log level
        $colorTag = match ($levelName) {
            'EMERGENCY', 'ALERT', 'CRITICAL' => 'error',
            'ERROR' => 'fg=red',
            'WARNING', 'NOTICE' => 'comment',
            default => 'info',
        };

        // Build message parts using array for better performance
        $parts = [];
        $parts[] = '<' . $colorTag . '>[' . $levelName . ']</>';

        // Add tags efficiently
        foreach ($tags as $value) {
            $parts[] = '[' . $value . ']';
        }

        $parts[] = ' ' . $message;

        // Handle context variables efficiently - only if they exist in the message
        if (! empty($context) && str_contains($message, '{')) {
            $formattedMessage = implode('', $parts);

            // Fast context replacement - only replace if placeholders exist
            foreach ($context as $key => $value) {
                $placeholder = '{' . $key . '}';
                if (str_contains($formattedMessage, $placeholder)) {
                    // Handle objects efficiently
                    if (is_object($value) && ! $value instanceof Stringable) {
                        $value = '<OBJECT> ' . $value::class;
                    } elseif (is_array($value)) {
                        $value = json_encode($value, JSON_UNESCAPED_UNICODE);
                    } else {
                        $value = (string) $value;
                    }

                    $formattedMessage = str_replace($placeholder, $value, $formattedMessage);
                }
            }

            return $formattedMessage;
        }

        return implode('', $parts);
    }
}
