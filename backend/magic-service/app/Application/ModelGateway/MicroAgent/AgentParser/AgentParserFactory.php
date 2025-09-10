<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\MicroAgent\AgentParser;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

readonly class AgentParserFactory
{
    /** @var AgentParserInterface[] */
    private array $parsers;

    public function __construct()
    {
        // Initialize available parsers
        $this->parsers = [
            new YamlAgentParser(),
            // Add more parsers here in the future
        ];
    }

    /**
     * Get agent content by agent name.
     */
    public function getAgentContent(string $agent): array
    {
        // Find agent file
        $agentFilePath = $this->findAgentFile($agent);

        // Get appropriate parser for the file
        $parser = $this->getParserForFile($agentFilePath);

        // Parse and return content
        return $parser->loadFromFile($agentFilePath);
    }

    /**
     * Get agent content from specified file path.
     */
    public function getAgentContentFromFile(string $filePath): array
    {
        if (! file_exists($filePath)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.file_not_found', [
                'file' => $filePath,
            ]);
        }

        // Get appropriate parser for the file
        $parser = $this->getParserForFile($filePath);

        // Parse and return content
        return $parser->loadFromFile($filePath);
    }

    /**
     * Find agent file by trying different supported extensions.
     * Supports both flat structure (agent) and directory structure (directory.agent).
     */
    private function findAgentFile(string $agent): string
    {
        $basePath = $this->getBasePath();
        $supportedExtensions = $this->getAllSupportedExtensions();

        // Parse agent name to support directory.agent format
        if (str_contains($agent, '.')) {
            // Directory format: SuperMagicAgent.content_generator -> SuperMagicAgent/content_generator
            $parts = explode('.', $agent, 2);
            $directory = $parts[0];
            $agentName = $parts[1];
            $agentPath = $directory . '/' . $agentName;
        } else {
            // Flat format: example -> example
            $agentPath = $agent;
        }

        // Try different supported extensions
        foreach ($supportedExtensions as $extension) {
            $filePath = $basePath . '/' . $agentPath . '.' . $extension;
            if (file_exists($filePath)) {
                return $filePath;
            }
        }

        ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.file_not_found', [
            'file' => $basePath . '/' . $agentPath . '.{' . implode(',', $supportedExtensions) . '}',
        ]);
    }

    /**
     * Get parser for the given file.
     */
    private function getParserForFile(string $filePath): AgentParserInterface
    {
        $fileName = basename($filePath);

        foreach ($this->parsers as $parser) {
            if (array_any($parser->getSupportedExtensions(), fn ($extension) => str_ends_with($fileName, '.' . $extension))) {
                return $parser;
            }
        }

        ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.unsupported_format', [
            'file' => $filePath,
            'supported_extensions' => $this->getAllSupportedExtensions(),
        ]);
    }

    /**
     * Get all supported extensions from all parsers.
     */
    private function getAllSupportedExtensions(): array
    {
        $extensions = [];

        foreach ($this->parsers as $parser) {
            $extensions = array_merge($extensions, $parser->getSupportedExtensions());
        }

        return array_unique($extensions);
    }

    /**
     * Get base path for agent files.
     */
    private function getBasePath(): string
    {
        return BASE_PATH . '/app/Application/ModelGateway/MicroAgent/Prompt';
    }
}
