import Dexie, { Table } from "dexie"
import { nanoid } from "nanoid"
import { logger as Logger } from "@/infrastructure/logger"
import type { ImageStorageInterface } from "./interface"
import { ImageStorageUnavailableError } from "./errors"

const logger = Logger.createLogger("tiptap-image-storage")

/**
 * Image record structure in IndexedDB
 */
interface ImageRecord {
	id: string
	blob: Blob
	createdAt: number
	expiresAt: number
	mimeType: string
	size: number
}

/**
 * Dexie database class for image storage
 */
class TiptapImageStorageDB extends Dexie {
	images!: Table<ImageRecord, string>

	constructor() {
		super("TiptapImageStorage")
		this.version(1).stores({
			images: "id, createdAt, expiresAt, size, mimeType",
		})
	}
}

/**
 * IndexedDB-based image storage implementation
 * Implements ImageStorageInterface using Dexie.js
 * Singleton pattern to ensure only one instance manages the database
 */
export class ImageStorageDatabase implements ImageStorageInterface {
	private static instance: ImageStorageDatabase | null = null
	private db: TiptapImageStorageDB | null = null
	private dbPromise: Promise<TiptapImageStorageDB> | null = null
	private cleanupInterval: NodeJS.Timeout | null = null

	/**
	 * Default expiration time in days
	 */
	private static readonly DEFAULT_EXPIRES_IN_DAYS = 7

	/**
	 * Database initialization timeout in milliseconds (10 seconds)
	 */
	private static readonly DB_INIT_TIMEOUT_MS = 10000

	/**
	 * Private constructor to prevent direct instantiation
	 * Use ImageStorageDatabase.getInstance() instead
	 */
	private constructor() {
		// Singleton pattern - use getInstance() to get the instance
	}

	/**
	 * Get the singleton instance
	 */
	static getInstance(): ImageStorageDatabase {
		if (!ImageStorageDatabase.instance) {
			ImageStorageDatabase.instance = new ImageStorageDatabase()
		}
		return ImageStorageDatabase.instance
	}

	/**
	 * Get or initialize the database instance
	 */
	private async getDatabase(): Promise<TiptapImageStorageDB> {
		if (this.db) return this.db

		if (this.dbPromise) return this.dbPromise

		this.dbPromise = this.initializeDatabase()
		return this.dbPromise
	}

	/**
	 * Wrap a promise with timeout functionality
	 */
	private withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number,
		errorMessage: string,
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				setTimeout(() => {
					reject(
						new ImageStorageUnavailableError(
							`${errorMessage} (timeout after ${timeoutMs}ms)`,
						),
					)
				}, timeoutMs)
			}),
		])
	}

	/**
	 * Initialize the database
	 */
	private async initializeDatabase(): Promise<TiptapImageStorageDB> {
		try {
			const db = new TiptapImageStorageDB()

			// Wrap db.open() with timeout to prevent hanging indefinitely
			await this.withTimeout(
				db.open(),
				ImageStorageDatabase.DB_INIT_TIMEOUT_MS,
				"Database initialization timed out",
			)

			this.db = db
			logger.log("Image storage database initialized successfully")

			// Clean expired images on initialization
			this.cleanExpiredImages().catch((error) => {
				logger.error({
					eventKey: "clean_expired_images_initialization_failed",
					errorKind: "storage",
					error: error,
					message: "Failed to clean expired images on initialization",
				})
			})

			// Set up periodic cleanup (every 24 hours)
			this.setupPeriodicCleanup()

			return db
		} catch (error) {
			logger.error({
				eventKey: "initialize_image_storage_database_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to initialize image storage database",
			})

			// Reset dbPromise to allow retry on next attempt
			this.dbPromise = null

			throw new ImageStorageUnavailableError(
				`Failed to initialize database: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			)
		}
	}

	/**
	 * Set up periodic cleanup of expired images
	 */
	private setupPeriodicCleanup(): void {
		// Clear existing interval if any
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
		}

		// Run cleanup every 24 hours
		const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
		this.cleanupInterval = setInterval(() => {
			this.cleanExpiredImages().catch((error) => {
				logger.error({
					eventKey: "periodic_cleanup_failed",
					errorKind: "storage",
					error: error,
					message: "Periodic cleanup failed",
				})
			})
		}, CLEANUP_INTERVAL_MS)
	}

	/**
	 * Check if IndexedDB is available
	 */
	async checkAvailability(): Promise<boolean> {
		try {
			if (typeof indexedDB === "undefined" || !indexedDB) {
				return false
			}

			// Try to open a test database to ensure it actually works
			const testDb = new TiptapImageStorageDB()
			await this.withTimeout(
				testDb.open(),
				ImageStorageDatabase.DB_INIT_TIMEOUT_MS,
				"IndexedDB availability check timed out",
			)
			testDb.close()

			return true
		} catch (error) {
			logger.warn("IndexedDB availability check failed", error)
			return false
		}
	}

	/**
	 * Save an image to storage
	 */
	async saveImage(
		file: File,
		expiresInDays: number = ImageStorageDatabase.DEFAULT_EXPIRES_IN_DAYS,
	): Promise<string> {
		try {
			const db = await this.getDatabase()
			const id = nanoid()

			const now = Date.now()
			const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000

			const record: ImageRecord = {
				id,
				blob: file,
				createdAt: now,
				expiresAt,
				mimeType: file.type,
				size: file.size,
			}

			await db.images.add(record)

			logger.log("Image saved successfully", {
				id,
				size: file.size,
				type: file.type,
				expiresInDays,
			})

			return id
		} catch (error) {
			logger.error({
				eventKey: "save_image_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to save image",
			})
			throw error
		}
	}

	/**
	 * Retrieve an image from storage
	 */
	async getImage(id: string): Promise<Blob | null> {
		try {
			const db = await this.getDatabase()
			const record = await db.images.get(id)

			if (!record) {
				logger.warn("Image not found", { id })
				return null
			}

			// Check if image has expired
			if (record.expiresAt < Date.now()) {
				logger.warn("Image has expired, deleting", { id })
				await this.deleteImage(id)
				return null
			}

			logger.log("Image retrieved successfully", { id, size: record.size })

			return record.blob
		} catch (error) {
			logger.error({
				eventKey: "retrieve_image_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to retrieve image",
				context: { id },
			})
			throw error
		}
	}

	/**
	 * Delete an image from storage
	 */
	async deleteImage(id: string): Promise<void> {
		try {
			const db = await this.getDatabase()
			await db.images.delete(id)

			logger.log("Image deleted successfully", { id })
		} catch (error) {
			logger.error({
				eventKey: "delete_image_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to delete image",
				context: { id },
			})
			throw error
		}
	}

	/**
	 * Get total storage size used
	 */
	async getStorageSize(): Promise<number> {
		try {
			const db = await this.getDatabase()
			const images = await db.images.toArray()
			return images.reduce((total, img) => total + img.size, 0)
		} catch (error) {
			logger.error({
				eventKey: "get_storage_size_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to get storage size",
			})
			return 0
		}
	}

	/**
	 * Get number of stored images
	 */
	async getImageCount(): Promise<number> {
		try {
			const db = await this.getDatabase()
			return await db.images.count()
		} catch (error) {
			logger.error({
				eventKey: "get_image_count_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to get image count",
			})
			return 0
		}
	}

	/**
	 * Clear all stored images
	 */
	async clearAll(): Promise<void> {
		try {
			const db = await this.getDatabase()
			await db.images.clear()
			logger.log("All images cleared")
		} catch (error) {
			logger.error({
				eventKey: "clear_images_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to clear images",
			})
			throw error
		}
	}

	/**
	 * Clean up expired images from storage
	 * @returns Number of images deleted
	 */
	async cleanExpiredImages(): Promise<number> {
		try {
			const db = await this.getDatabase()
			const now = Date.now()

			// Find all expired images
			const expiredImages = await db.images.where("expiresAt").below(now).toArray()

			if (expiredImages.length === 0) {
				logger.log("No expired images to clean")
				return 0
			}

			// Delete expired images
			const expiredIds = expiredImages.map((img) => img.id)
			await db.images.bulkDelete(expiredIds)

			logger.log("Cleaned expired images", {
				count: expiredImages.length,
				totalSize: expiredImages.reduce((sum, img) => sum + img.size, 0),
			})

			return expiredImages.length
		} catch (error) {
			logger.error({
				eventKey: "clean_expired_images_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to clean expired images",
			})
			throw error
		}
	}

	/**
	 * Get list of expired image IDs
	 */
	async getExpiredImageIds(): Promise<string[]> {
		try {
			const db = await this.getDatabase()
			const now = Date.now()

			const expiredImages = await db.images.where("expiresAt").below(now).toArray()

			return expiredImages.map((img) => img.id)
		} catch (error) {
			logger.error({
				eventKey: "get_expired_image_ids_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to get expired image IDs",
			})
			return []
		}
	}

	/**
	 * Cleanup and close the database
	 */
	async close(): Promise<void> {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}

		if (this.db) {
			this.db.close()
			this.db = null
		}

		this.dbPromise = null
	}
}
