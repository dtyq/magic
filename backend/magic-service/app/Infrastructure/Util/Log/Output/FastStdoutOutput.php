<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Output;

use InvalidArgumentException;
use Symfony\Component\Console\Formatter\OutputFormatterInterface;
use Symfony\Component\Console\Formatter\OutputFormatterStyleInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Fast stdout output that bypasses Symfony's OutputFormatter
 * Optimized for high-performance logging without coroutine blocking.
 */
class FastStdoutOutput implements OutputInterface
{
    // ANSI color codes for direct terminal output
    private const COLORS = [
        'error' => "\033[37;41m",      // white text on red background
        'fg=red' => "\033[31m",        // red text
        'comment' => "\033[33m",       // yellow text
        'info' => "\033[32m",          // green text
        'reset' => "\033[0m",          // reset all formatting
    ];

    /**
     * @var self::VERBOSITY_*
     */
    private int $verbosity = self::VERBOSITY_NORMAL;

    private bool $decorated = true;

    public function __construct()
    {
        // Detect if we should use colors (check if stdout is a terminal)
        $this->decorated = $this->hasColorSupport();
    }

    public function write(iterable|string $messages, bool $newline = false, int $options = 0): void
    {
        $messages = is_iterable($messages) ? $messages : [$messages];

        foreach ($messages as $message) {
            $formatted = $this->formatMessage($message);

            if ($newline) {
                $formatted .= "\n";
            }

            // Direct write to stdout - fastest method
            fwrite(STDOUT, $formatted);
        }
    }

    public function writeln(iterable|string $messages, int $options = 0): void
    {
        $this->write($messages, true, $options);
    }

    // Required interface methods - minimal implementations
    /**
     * @param self::VERBOSITY_* $level
     */
    public function setVerbosity(int $level): void
    {
        $this->verbosity = $level;
    }

    /**
     * @return self::VERBOSITY_*
     */
    public function getVerbosity(): int
    {
        return $this->verbosity;
    }

    public function isQuiet(): bool
    {
        return $this->verbosity === self::VERBOSITY_QUIET;
    }

    public function isVerbose(): bool
    {
        return self::VERBOSITY_VERBOSE <= $this->verbosity;
    }

    public function isVeryVerbose(): bool
    {
        return self::VERBOSITY_VERY_VERBOSE <= $this->verbosity;
    }

    public function isDebug(): bool
    {
        return self::VERBOSITY_DEBUG <= $this->verbosity;
    }

    public function setDecorated(bool $decorated): void
    {
        $this->decorated = $decorated;
    }

    public function isDecorated(): bool
    {
        return $this->decorated;
    }

    public function setFormatter($formatter): void
    {
        // Intentionally empty - we don't use external formatters
    }

    public function getFormatter(): OutputFormatterInterface
    {
        // Return a minimal dummy formatter that implements OutputFormatterInterface
        return new class implements OutputFormatterInterface {
            public function format(?string $message): ?string
            {
                return $message;
            }

            public function isDecorated(): bool
            {
                return true;
            }

            public function setDecorated(bool $decorated): void
            {
                // no-op
            }

            public function setStyle(string $name, $style): void
            {
                // no-op
            }

            public function hasStyle(string $name): bool
            {
                return false;
            }

            public function getStyle(string $name): OutputFormatterStyleInterface
            {
                throw new InvalidArgumentException("Style '{$name}' is not supported by FastStdoutOutput");
            }
        };
    }

    /**
     * Fast message formatting - only handles basic color tags
     * Avoids regex and complex parsing of OutputFormatter.
     */
    private function formatMessage(string $message): string
    {
        if (! $this->decorated) {
            // Remove any color tags when colors are disabled
            return preg_replace('/<[^>]*>/', '', $message) ?? $message;
        }

        // Simple and fast color replacement - only handle the tags we actually use
        return str_replace(
            ['<error>', '</error>', '<fg=red>', '</fg=red>', '<comment>', '</comment>', '<info>', '</info>', '</>'],
            [
                self::COLORS['error'],
                self::COLORS['reset'],
                self::COLORS['fg=red'],
                self::COLORS['reset'],
                self::COLORS['comment'],
                self::COLORS['reset'],
                self::COLORS['info'],
                self::COLORS['reset'],
                self::COLORS['reset'],
            ],
            $message
        );
    }

    /**
     * Check if the current environment supports colors.
     */
    private function hasColorSupport(): bool
    {
        // Check if stdout is a terminal
        if (function_exists('posix_isatty')) {
            return @posix_isatty(STDOUT);
        }

        // Fallback checks
        if (isset($_ENV['NO_COLOR']) || isset($_SERVER['NO_COLOR'])) {
            return false;
        }

        if (isset($_ENV['TERM']) && $_ENV['TERM'] === 'dumb') {
            return false;
        }

        // Default to supporting colors
        return true;
    }
}
