<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\SSRF;

use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class SSRFDefense
{
    private SSRFDefenseOptions $options;

    private string $url;

    private string $scheme;

    private string $host;

    private int $port;

    private string $ip;

    private ?LoggerInterface $logger = null;

    public function __construct(string $url, SSRFDefenseOptions $options)
    {
        if (! $this->isUrl($url)) {
            throw new SSRFException("[{$url}] not a valid URL");
        }
        $this->options = $options;
        $parsedUrl = parse_url($url);
        $this->url = $url;
        $this->host = $parsedUrl['host'] ?? '';
        $this->scheme = $parsedUrl['scheme'] ?? '';
        $this->port = $parsedUrl['port'] ?? 0;
        $this->parseIp();
        
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(self::class);
        } catch (\Throwable $e) {
            $this->logger = null;
        }
    }

    public function getSafeUrl(?bool $allowRedirect = null): string
    {
        if (is_null($allowRedirect)) {
            $allowRedirect = $this->options->isAllowRedirect();
        }
        $this->isValid($allowRedirect);

        $url = $this->url;
        // 替换成 ip 访问，此时需要在请求中添加 Host 才行
        if ($this->options->isReplaceIp()) {
            $url = str_replace($this->host, $this->ip, $url);
        }

        return $url;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getScheme(): string
    {
        return $this->scheme;
    }

    public function getHost(): string
    {
        return $this->host;
    }

    public function getPort(): int
    {
        return $this->port;
    }

    public function getIp(): string
    {
        return $this->ip;
    }

    private function isValid(bool $allowRedirect = false): void
    {
        $label = "[{$this->host}][{$this->ip}]";
        if ($this->host === $this->ip) {
            $label = "[{$this->ip}]";
        }

        // 黑名单优先
        if (in_array($this->ip, $this->options->getBlackList())) {
            throw new SSRFException("{$label} is in black list");
        }
        if (in_array($this->host, $this->options->getBlackList())) {
            throw new SSRFException("{$label} is in black list");
        }

        if (! in_array($this->scheme, $this->options->getAllowProtocols(), true)) {
            throw new SSRFException("[{$this->scheme}] is not allowed");
        }

        if (in_array($this->ip, $this->options->getWhiteList()) || in_array($this->host, $this->options->getWhiteList())) {
            return;
        }

        // 验证ip是否是公网ip
        $ip = filter_var($this->ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
        if ($ip === false) {
            throw new SSRFException("{$label} is not a public ip");
        }

        if (! $allowRedirect) {
            if ($this->isRedirectUrl($this->url)) {
                throw new SSRFException("[{$label}] cannot be a redirect url");
            }
        }
    }

    private function parseIp(): void
    {
        $ip = '';
        if (filter_var($this->host, FILTER_VALIDATE_IP)) {
            $ip = $this->host;
        } elseif (filter_var($this->host, FILTER_VALIDATE_DOMAIN)) {
            $ip = gethostbyname($this->host);
            if (empty($ip)) {
                throw new SSRFException("[{$this->host}] parse ip failed");
            }
        }
        $this->ip = $ip;
    }

    private function isUrl(string $url): bool
    {
        /*
         * This pattern is derived from Symfony\Component\Validator\Constraints\UrlValidator (2.7.4).
         *
         * (c) Fabien Potencier <fabien@symfony.com> http://symfony.com
         */
        $pattern = '~^
            ((aaa|aaas|about|acap|acct|acr|adiumxtra|afp|afs|aim|apt|attachment|aw|barion|beshare|bitcoin|blob|bolo|callto|cap|chrome|chrome-extension|cid|coap|coaps|com-eventbrite-attendee|content|crid|cvs|data|dav|dict|dlna-playcontainer|dlna-playsingle|dns|dntp|dtn|dvb|ed2k|example|facetime|fax|feed|feedready|file|filesystem|finger|fish|ftp|geo|gg|git|gizmoproject|go|gopher|gtalk|h323|ham|hcp|http|https|iax|icap|icon|im|imap|info|iotdisco|ipn|ipp|ipps|irc|irc6|ircs|iris|iris.beep|iris.lwz|iris.xpc|iris.xpcs|itms|jabber|jar|jms|keyparc|lastfm|ldap|ldaps|magnet|mailserver|mailto|maps|market|message|mid|mms|modem|ms-help|ms-settings|ms-settings-airplanemode|ms-settings-bluetooth|ms-settings-camera|ms-settings-cellular|ms-settings-cloudstorage|ms-settings-emailandaccounts|ms-settings-language|ms-settings-location|ms-settings-lock|ms-settings-nfctransactions|ms-settings-notifications|ms-settings-power|ms-settings-privacy|ms-settings-proximity|ms-settings-screenrotation|ms-settings-wifi|ms-settings-workplace|msnim|msrp|msrps|mtqp|mumble|mupdate|mvn|news|nfs|ni|nih|nntp|notes|oid|opaquelocktoken|pack|palm|paparazzi|pkcs11|platform|pop|pres|prospero|proxy|psyc|query|redis|rediss|reload|res|resource|rmi|rsync|rtmfp|rtmp|rtsp|rtsps|rtspu|secondlife|s3|service|session|sftp|sgn|shttp|sieve|sip|sips|skype|smb|sms|smtp|snews|snmp|soap.beep|soap.beeps|soldat|spotify|ssh|steam|stun|stuns|submit|svn|tag|teamspeak|tel|teliaeid|telnet|tftp|things|thismessage|tip|tn3270|turn|turns|tv|udp|unreal|urn|ut2004|vemmi|ventrilo|videotex|view-source|wais|webcal|ws|wss|wtai|wyciwyg|xcon|xcon-userid|xfire|xmlrpc\.beep|xmlrpc.beeps|xmpp|xri|ymsgr|z39\.50|z39\.50r|z39\.50s))://                                 # protocol
            (([\pL\pN-]+:)?([\pL\pN-]+)@)?          # basic auth
            (
                ([\pL\pN\pS\-\.])+(\.?([\pL]|xn\-\-[\pL\pN-]+)+\.?) # a domain name
                    |                                              # or
                \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}                 # an IP address
                    |                                              # or
                \[
                    (?:(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){6})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:::(?:(?:(?:[0-9a-f]{1,4})):){5})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:[0-9a-f]{1,4})))?::(?:(?:(?:[0-9a-f]{1,4})):){4})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,1}(?:(?:[0-9a-f]{1,4})))?::(?:(?:(?:[0-9a-f]{1,4})):){3})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,2}(?:(?:[0-9a-f]{1,4})))?::(?:(?:(?:[0-9a-f]{1,4})):){2})(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,3}(?:(?:[0-9a-f]{1,4})))?::(?:(?:[0-9a-f]{1,4})):)(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,4}(?:(?:[0-9a-f]{1,4})))?::)(?:(?:(?:(?:(?:[0-9a-f]{1,4})):(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,5}(?:(?:[0-9a-f]{1,4})))?::)(?:(?:[0-9a-f]{1,4})))|(?:(?:(?:(?:(?:(?:[0-9a-f]{1,4})):){0,6}(?:(?:[0-9a-f]{1,4})))?::))))
                \]  # an IPv6 address
            )
            (:[0-9]+)?                              # a port (optional)
            (/?|/\S+|\?\S*|\#\S*)                   # a /, nothing, a / with something, a query or a fragment
        $~ixu';

        return preg_match($pattern, $url) > 0;
    }

    private function isRedirectUrl(string $url): bool
    {
        $this->logger?->info('Checking if URL is redirect', ['url' => $url]);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_NOBODY, true);              // 只获取HTTP头，不下载body
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);                // 超时5秒
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);         // 连接超时3秒
        curl_setopt($ch, CURLOPT_MAXREDIRS, 0);              // 不跟随重定向
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);      // 验证SSL证书
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);         // 验证SSL主机
        try {
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            
            $this->logger?->info('URL redirect check result', [
                'url' => $url,
                'http_code' => $httpCode,
                'is_redirect' => ($httpCode >= 300 && $httpCode < 400),
                'curl_error' => $curlError ?: null,
            ]);
            
            if ($httpCode >= 300 && $httpCode < 400) {
                return true;
            }
            return false;
        } finally {
            curl_close($ch);
        }
    }
}
