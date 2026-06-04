package vision

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"sync"
	"time"

	"github.com/klippa-app/go-pdfium"
	"github.com/klippa-app/go-pdfium/requests"
	"github.com/klippa-app/go-pdfium/webassembly"
	xdraw "golang.org/x/image/draw"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

const (
	maxJPEGQuality             = 100
	minJPEGQuality             = 40
	jpegQualityStep            = 10
	initialDownscalePercent    = 85
	minDownscalePercent        = 50
	downscaleStepPercent       = 15
	defaultPDFiumAcquireTimout = 30 * time.Second
	pdfiumMinIdleWorkers       = 1
	pdfiumMaxIdleWorkers       = 1
	pdfiumMaxTotalWorkers      = 1
)

var (
	errPDFRendererUnavailable    = errors.New("pdf renderer unavailable")
	errPDFDataEmpty              = errors.New("pdf data is empty")
	errPDFiumPoolUnavailable     = errors.New("pdfium pool unavailable")
	errPDFPageHandlerUnavailable = errors.New("pdf page handler unavailable")
	errRenderedPageImageAbsent   = errors.New("rendered page image is nil")
)

// RenderedPDFPage 是渲染后的 PDF 页面图片。
type RenderedPDFPage struct {
	Index     int
	PageCount int
	Image     []byte
	MIMEType  string
}

// PDFPageRenderer 定义 PDF 页面渲染能力。
type PDFPageRenderer interface {
	RenderPages(
		ctx context.Context,
		data []byte,
		cfg Config,
		limits documentdomain.ResourceLimits,
		handle func(RenderedPDFPage) error,
	) error
}

// PDFiumPageRenderer 使用 go-pdfium WebAssembly 渲染 PDF。
type PDFiumPageRenderer struct {
	mu       sync.Mutex
	pool     pdfium.Pool
	initErr  error
	initOnce sync.Once
}

// NewPDFiumPageRenderer 创建基于 go-pdfium WebAssembly 的 PDF 页面渲染器。
func NewPDFiumPageRenderer() *PDFiumPageRenderer {
	return &PDFiumPageRenderer{}
}

// RenderPages 将 PDF 每页渲染为符合大小限制的 JPEG 图片并逐页回调。
func (r *PDFiumPageRenderer) RenderPages(
	ctx context.Context,
	data []byte,
	cfg Config,
	limits documentdomain.ResourceLimits,
	handle func(RenderedPDFPage) error,
) error {
	if r == nil {
		return errPDFRendererUnavailable
	}
	if len(data) == 0 {
		return errPDFDataEmpty
	}
	if handle == nil {
		return errPDFPageHandlerUnavailable
	}
	normalized := normalizeConfig(cfg)
	if err := r.ensurePool(); err != nil {
		return err
	}

	acquireCtx, cancel := context.WithTimeout(ctx, defaultPDFiumAcquireTimout)
	defer cancel()
	instance, err := r.pool.GetInstanceWithContext(acquireCtx)
	if err != nil {
		return fmt.Errorf("acquire pdfium instance: %w", err)
	}
	defer func() { _ = instance.Close() }()

	doc, err := instance.OpenDocument(&requests.OpenDocument{File: &data})
	if err != nil {
		return fmt.Errorf("open pdf with pdfium: %w", err)
	}
	defer func() {
		_, _ = instance.FPDF_CloseDocument(&requests.FPDF_CloseDocument{Document: doc.Document})
	}()

	pageCount, err := instance.FPDF_GetPageCount(&requests.FPDF_GetPageCount{Document: doc.Document})
	if err != nil {
		return fmt.Errorf("get pdf page count: %w", err)
	}
	if err := documentdomain.CheckPDFPageCount(pageCount.PageCount, limits); err != nil {
		return fmt.Errorf("check pdf page count: %w", err)
	}

	for pageIndex := range pageCount.PageCount {
		rendered, err := instance.RenderPageInDPI(&requests.RenderPageInDPI{
			DPI: normalized.PDFRenderDPI,
			Page: requests.Page{
				ByIndex: &requests.PageByIndex{
					Document: doc.Document,
					Index:    pageIndex,
				},
			},
		})
		if err != nil {
			return fmt.Errorf("render pdf page %d: %w", pageIndex+1, err)
		}
		imageBytes, encodeErr := encodeJPEGWithinLimit(rendered.Result.Image, normalized)
		rendered.Cleanup()
		if encodeErr != nil {
			return fmt.Errorf("encode pdf page %d: %w", pageIndex+1, encodeErr)
		}
		if err := handle(RenderedPDFPage{
			Index:     pageIndex,
			PageCount: pageCount.PageCount,
			Image:     imageBytes,
			MIMEType:  mimeImageJPEG,
		}); err != nil {
			return fmt.Errorf("handle rendered pdf page %d: %w", pageIndex+1, err)
		}
	}
	return nil
}

func (r *PDFiumPageRenderer) ensurePool() error {
	r.initOnce.Do(func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.pool, r.initErr = webassembly.Init(webassembly.Config{
			MinIdle:      pdfiumMinIdleWorkers,
			MaxIdle:      pdfiumMaxIdleWorkers,
			MaxTotal:     pdfiumMaxTotalWorkers,
			ReuseWorkers: true,
			Stdout:       io.Discard,
			Stderr:       io.Discard,
		})
	})
	if r.initErr != nil {
		return fmt.Errorf("init pdfium webassembly: %w", r.initErr)
	}
	if r.pool == nil {
		return errPDFiumPoolUnavailable
	}
	return nil
}

func encodeJPEGWithinLimit(img image.Image, cfg Config) ([]byte, error) {
	if img == nil {
		return nil, errRenderedPageImageAbsent
	}
	normalized := normalizeConfig(cfg)
	for quality := normalized.JPEGQuality; quality >= minJPEGQuality; quality -= jpegQualityStep {
		data, err := encodeJPEG(img, quality)
		if err != nil {
			return nil, err
		}
		if int64(len(data)) <= normalized.MaxPageImageBytes {
			return data, nil
		}
	}
	for percent := initialDownscalePercent; percent >= minDownscalePercent; percent -= downscaleStepPercent {
		scaled := downscaleImage(img, percent)
		for quality := normalized.JPEGQuality; quality >= minJPEGQuality; quality -= jpegQualityStep {
			data, err := encodeJPEG(scaled, quality)
			if err != nil {
				return nil, err
			}
			if int64(len(data)) <= normalized.MaxPageImageBytes {
				return data, nil
			}
		}
	}
	data, err := encodeJPEG(downscaleImage(img, minDownscalePercent), minJPEGQuality)
	if err != nil {
		return nil, err
	}
	return nil, fmt.Errorf("%w", documentdomain.NewResourceLimitError(
		documentdomain.ResourceLimitMaxVisualPageImageBytes,
		normalized.MaxPageImageBytes,
		int64(len(data)),
		documentdomain.ResourceLimitStageVisualUnderstanding,
		"rendered pdf page image exceeds limit",
	))
}

func encodeJPEG(img image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}
	return buf.Bytes(), nil
}

func downscaleImage(src image.Image, percent int) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx() * percent / 100
	height := bounds.Dy() * percent / 100
	if width < 1 {
		width = 1
	}
	if height < 1 {
		height = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, xdraw.Over, nil)
	return dst
}
