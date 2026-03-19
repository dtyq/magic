package s3

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	sandboxconfig "github.com/dtyq/sandbox-components/pkg/sandbox-gateway/config"
	"github.com/dtyq/sandbox-components/pkg/sandbox-gateway/logger"
	"github.com/dtyq/sandbox-components/pkg/util/k8s"
)

type S3Service struct {
	client        *s3.Client
	config        *sandboxconfig.Config
	clientManager *k8s.ClientManager
}

func NewS3Service(cfg *sandboxconfig.Config, clientManager *k8s.ClientManager) (*S3Service, error) {
	ctx := context.Background()

	accessKey, secretKey, err := readS3Credentials(ctx, cfg, clientManager)
	if err != nil {
		return nil, fmt.Errorf("failed to read S3 credentials: %w", err)
	}

	awsConfig, err := config.LoadDefaultConfig(ctx,
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"")),
		config.WithRegion("us-east-1"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.S3URL)
		o.UsePathStyle = false
	})

	logger.Infof("S3 service created successfully with endpoint: %s", cfg.S3URL)

	return &S3Service{
		client:        s3Client,
		config:        cfg,
		clientManager: clientManager,
	}, nil
}

// readS3Credentials reads S3 credentials from Kubernetes Secret
func readS3Credentials(ctx context.Context, cfg *sandboxconfig.Config, clientManager *k8s.ClientManager) (string, string, error) {
	clientset := clientManager.GetClientset()

	secret, err := clientset.CoreV1().Secrets(cfg.S3SecretNamespace).Get(ctx, cfg.S3SecretName, metav1.GetOptions{})
	if err != nil {
		return "", "", fmt.Errorf("failed to get S3 secret %s/%s: %w", cfg.S3SecretNamespace, cfg.S3SecretName, err)
	}

	accessKey, ok := secret.Data["akId"]
	if !ok {
		return "", "", fmt.Errorf("akId not found in secret %s/%s", cfg.S3SecretNamespace, cfg.S3SecretName)
	}

	secretKey, ok := secret.Data["akSecret"]
	if !ok {
		return "", "", fmt.Errorf("akSecret not found in secret %s/%s", cfg.S3SecretNamespace, cfg.S3SecretName)
	}

	logger.Infof("Successfully read S3 credentials from secret: %s/%s", cfg.S3SecretNamespace, cfg.S3SecretName)
	return string(accessKey), string(secretKey), nil
}

// CopyObject copies S3 object from source to target
func (s *S3Service) CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	logger.Infof("Starting S3 copy operation: %s/%s -> %s/%s", sourceBucket, sourceKey, targetBucket, targetKey)

	copySource := fmt.Sprintf("%s/%s", sourceBucket, sourceKey)

	input := &s3.CopyObjectInput{
		Bucket:     aws.String(targetBucket),
		Key:        aws.String(targetKey),
		CopySource: aws.String(copySource),
	}

	_, err := s.client.CopyObject(ctx, input)
	if err != nil {
		logger.Errorf("Failed to copy S3 object: %v", err)
		return fmt.Errorf("failed to copy object from %s/%s to %s/%s: %w", sourceBucket, sourceKey, targetBucket, targetKey, err)
	}

	logger.Infof("Successfully copied S3 object: %s/%s -> %s/%s", sourceBucket, sourceKey, targetBucket, targetKey)
	return nil
}
