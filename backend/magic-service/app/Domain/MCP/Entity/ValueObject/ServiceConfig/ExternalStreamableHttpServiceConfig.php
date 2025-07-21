<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

class ExternalStreamableHttpServiceConfig extends ExternalSSEServiceConfig
{
    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setUrl($array['url'] ?? '');
        $instance->setAuthType($array['auth_type'] ?? 0);

        // Handle headers
        if (isset($array['headers']) && is_array($array['headers'])) {
            $headers = [];
            foreach ($array['headers'] as $headerData) {
                $headers[] = HeaderConfig::fromArray($headerData);
            }
            $instance->setHeaders($headers);
        }

        // Handle OAuth2 config
        if (isset($array['oauth2_config']) && is_array($array['oauth2_config'])) {
            $instance->setOauth2Config(Oauth2Config::fromArray($array['oauth2_config']));
        }

        return $instance;
    }
}
