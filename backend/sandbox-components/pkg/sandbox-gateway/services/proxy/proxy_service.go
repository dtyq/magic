package proxy

import (
	"fmt"
	"net/http"

	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/services/util"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
	utilproxy "github.com/dtyq/sandbox-components/pkg/util/proxy"
)

type ProxyService struct {
	clientManager *k8s.ClientManager
	config        *config.Config
}

func NewProxyService(clientManager *k8s.ClientManager, cfg *config.Config) *ProxyService {
	return &ProxyService{
		clientManager: clientManager,
		config:        cfg,
	}
}

func (p *ProxyService) ProxyHTTP(w http.ResponseWriter, r *http.Request, sandboxID, proxyPath string) error {
	serviceName := fmt.Sprintf("sandbox-%s", sandboxID)
	serviceURL := util.BuildServiceURL(serviceName, p.config.Namespace, p.config.AgentPort)

	logger.Infof("Proxying HTTP request: sandboxID=%s, proxyPath=%s, method=%s, serviceURL=%s",
		sandboxID, proxyPath, r.Method, serviceURL)

	proxyClient, err := utilproxy.NewClient(serviceURL)
	if err != nil {
		return fmt.Errorf("failed to create proxy client: %w", err)
	}

	proxyClient.ProxyHTTP(w, r, proxyPath, utilproxy.ProxyOptions{})

	logger.Infof("HTTP proxy request completed: sandboxID=%s, proxyPath=%s",
		sandboxID, proxyPath)

	return nil
}
