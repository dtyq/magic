package image

import (
	"os"

	"github.com/docker/cli/cli/config/configfile"
)

type dockerCLIConfig struct {
	configfile.ConfigFile
}

func (c *dockerCLIConfig) getExtraBuildArgs() (ret map[string]*string) {
	ret = make(map[string]*string)

	// "default" 是当前 daemon 的代理配置
	proxy, ok := c.Proxies["default"]
	if !ok {
		return
	}

	if proxy.HTTPProxy != "" {
		ret["HTTP_PROXY"] = &proxy.HTTPProxy
		ret["http_proxy"] = &proxy.HTTPProxy
	} else {
		// try environment variables
		if proxy := os.Getenv("HTTP_PROXY"); proxy != "" {
			ret["HTTP_PROXY"] = &proxy
		}
		if proxy := os.Getenv("http_proxy"); proxy != "" {
			ret["http_proxy"] = &proxy
		}
	}
	if proxy.HTTPSProxy != "" {
		ret["HTTPS_PROXY"] = &proxy.HTTPSProxy
		ret["https_proxy"] = &proxy.HTTPSProxy
	} else {
		// try environment variables
		if proxy := os.Getenv("HTTPS_PROXY"); proxy != "" {
			ret["HTTPS_PROXY"] = &proxy
		}
		if proxy := os.Getenv("https_proxy"); proxy != "" {
			ret["https_proxy"] = &proxy
		}
	}
	if proxy.NoProxy != "" {
		ret["NO_PROXY"] = &proxy.NoProxy
		ret["no_proxy"] = &proxy.NoProxy
	} else {
		// try environment variables
		if proxy := os.Getenv("NO_PROXY"); proxy != "" {
			ret["NO_PROXY"] = &proxy
		}
		if proxy := os.Getenv("no_proxy"); proxy != "" {
			ret["no_proxy"] = &proxy
		}
	}

	return ret
}
