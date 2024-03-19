<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShu;

use Fan\Feishu\AccessToken;
use Fan\Feishu\Config;
use Fan\Feishu\Contact;
use Fan\Feishu\Http;
use Fan\Feishu\Message;
use Fan\Feishu\Oauth;
use Fan\Feishu\Robot;
use Pimple\Container;

/**
 * @property Contact\Contact $contact
 * @property Message\Message $message
 * @property Oauth\Oauth $oauth
 * @property Robot\Robot $robot
 * @property AccessToken\TenantAccessToken $tenant_access_token
 * @property AccessToken\AppAccessToken $app_access_token
 * @property Http\Client $http
 * @property Image\Image $image
 * @property File\File $file
 */
class Application
{
    private Container $container;

    private array $providers = [
        AccessToken\AccessTokenProvider::class,
        Contact\ContactProvider::class,
        Http\ClientProvider::class,
        Message\MessageProvider::class,
        Oauth\OauthProvider::class,
        Robot\RobotProvider::class,
        Image\ImageProvider::class,
        File\FileProvider::class,
    ];

    /**
     * @param $config = [
     *               'app_id' => '',
     *               'app_secret' => '',
     *               'http' => [
     *               'base_uri' => 'https://open.feishu.cn/',
     *               'timeout' => 2,
     *               'http_errors' => false,
     *               ],
     *               ]
     */
    public function __construct(array $config)
    {
        $config = new Config\Config($config);
        $this->container = new Container([
            'config' => $config,
        ]);

        foreach ($this->providers as $provider) {
            $this->container->register(new $provider());
        }
    }

    public function __get(string $name)
    {
        return $this->container[$name] ?? null;
    }
}
