package service

import (
	"encoding/base64"
	"fmt"

	"lukechampine.com/blake3"
)

// Blake3Service handles BLAKE3 hash signing operations
type Blake3Service struct {
	key []byte
}

// NewBlake3Service creates a new Blake3 service instance
func NewBlake3Service(keyBase64 string) (*Blake3Service, error) {
	// Decode base64 key
	keyBytes, err := base64.StdEncoding.DecodeString(keyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode key: %w", err)
	}

	// Key cannot be empty
	if len(keyBytes) == 0 {
		return nil, fmt.Errorf("key cannot be empty")
	}

	return &Blake3Service{
		key: keyBytes,
	}, nil
}

// SignData generates a 16-byte BLAKE3 hash of the given data
func (s *Blake3Service) SignData(data string) (string, error) {
	if s.key == nil {
		return "", fmt.Errorf("key not initialized")
	}

	// Create BLAKE3 hasher with 16-byte output and key
	hasher := blake3.New(16, s.key)
	hasher.Write([]byte(data))
	hash := hasher.Sum(nil)

	// Return base64-encoded hash
	encodedHash := base64.StdEncoding.EncodeToString(hash)
	return encodedHash, nil
}

// VerifySignature verifies a hash against data by regenerating the hash
func (s *Blake3Service) VerifySignature(data, signatureBase64 string) (bool, error) {
	if s.key == nil {
		return false, fmt.Errorf("key not initialized")
	}

	// Generate expected hash
	expectedSignature, err := s.SignData(data)
	if err != nil {
		return false, fmt.Errorf("failed to generate expected signature: %w", err)
	}

	// Compare signatures
	return expectedSignature == signatureBase64, nil
}
