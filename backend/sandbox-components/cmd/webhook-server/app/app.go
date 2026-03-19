package app

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	webhookserver "github.com/dtyq/sandbox-components/pkg/webhook-server"
	"github.com/dtyq/sandbox-components/pkg/webhook-server/config"
)

func NewWebhookServerCommand(sigCh <-chan os.Signal) *cobra.Command {
	rootCmd := &cobra.Command{
		Use:          "webhook-server",
		Short:        "Sandbox Components Webhook Server",
		Long:         `Webhook Server for sandbox components, providing image pull trigger API`,
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return Run(sigCh)
		},
	}

	return rootCmd
}

func Run(sigCh <-chan os.Signal) error {
	logrus.Info("Starting Webhook Server")

	server, err := RunWebhookServer()
	if err != nil {
		logrus.Errorf("Failed to run Webhook Server: %v", err)
		return err
	}

	if sigCh == nil {
		localSigCh := make(chan os.Signal, 1)
		signal.Notify(localSigCh, syscall.SIGINT, syscall.SIGTERM)
		sigCh = localSigCh
	}

	sig := <-sigCh
	logrus.Infof("Received signal %s, shutting down...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logrus.Errorf("Server shutdown error: %v", err)
	}

	logrus.Info("Server gracefully stopped")
	return nil
}

func RunWebhookServer() (*webhookserver.WebhookServer, error) {
	server, err := webhookserver.NewWebhookServer()
	if err != nil {
		logrus.Errorf("Failed to create Webhook Server: %v", err)
		return nil, err
	}

	if err := server.Run(); err != nil {
		logrus.Errorf("Failed to start Webhook Server: %v", err)
		return nil, err
	}

	cfg := config.GetConfig()
	logrus.Infof("Webhook Server started successfully on %s:%d", cfg.BindAddress, cfg.Port)
	return server, nil
}

func Execute(sigCh <-chan os.Signal) error {
	return NewWebhookServerCommand(sigCh).Execute()
}
