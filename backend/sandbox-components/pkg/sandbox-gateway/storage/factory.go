package storage

import (
	"fmt"
)

type StorageFactory struct {
	providers map[StorageType]StorageProvider
}

func NewStorageFactory() *StorageFactory {
	factory := &StorageFactory{
		providers: make(map[StorageType]StorageProvider),
	}

	return factory
}

func (f *StorageFactory) RegisterProvider(storageType StorageType, provider StorageProvider) {
	f.providers[storageType] = provider
}

func (f *StorageFactory) GetProvider(storageType StorageType) (StorageProvider, error) {
	provider, exists := f.providers[storageType]
	if !exists {
		return nil, fmt.Errorf("unsupported storage type: %s", storageType)
	}
	return provider, nil
}

func (f *StorageFactory) GetSupportedTypes() []StorageType {
	types := make([]StorageType, 0, len(f.providers))
	for storageType := range f.providers {
		types = append(types, storageType)
	}
	return types
}
