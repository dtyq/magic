package service

import (
	"crypto/ed25519"
	"encoding/base64"
	"fmt"
)

// Ed25519Service handles Ed25519 signing operations
type Ed25519Service struct {
	privateKey ed25519.PrivateKey
}

// NewEd25519Service creates a new Ed25519 service instance
func NewEd25519Service(privateKeyBase64 string) (*Ed25519Service, error) {
	// Decode base64 private key
	privateKeyBytes, err := base64.StdEncoding.DecodeString(privateKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key: %w", err)
	}

	// Validate private key length (Ed25519 private key is 64 bytes)
	if len(privateKeyBytes) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key length: expected %d bytes, got %d",
			ed25519.PrivateKeySize, len(privateKeyBytes))
	}

	privateKey := ed25519.PrivateKey(privateKeyBytes)

	return &Ed25519Service{
		privateKey: privateKey,
	}, nil
}

// SignData signs the given data and returns a base64-encoded signature
func (s *Ed25519Service) SignData(data string) (string, error) {
	if s.privateKey == nil {
		return "", fmt.Errorf("private key not initialized")
	}

	// Convert data to bytes
	dataBytes := []byte(data)

	// Sign the data
	signature := ed25519.Sign(s.privateKey, dataBytes)

	// Return base64-encoded signature
	encodedSignature := base64.StdEncoding.EncodeToString(signature)

	return encodedSignature, nil
}

// VerifySignature verifies a signature against data using the public key
// This method is for potential future use
func (s *Ed25519Service) VerifySignature(data, signatureBase64 string) (bool, error) {
	if s.privateKey == nil {
		return false, fmt.Errorf("private key not initialized")
	}

	// Decode signature from base64
	signature, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return false, fmt.Errorf("failed to decode signature: %w", err)
	}

	// Get public key from private key
	publicKey := s.privateKey.Public().(ed25519.PublicKey)

	// Verify signature
	isValid := ed25519.Verify(publicKey, []byte(data), signature)

	return isValid, nil
}
