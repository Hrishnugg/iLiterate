declare module "pdfjs-dist" {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    destroy(): void;
  }

  export interface PDFPageProxy {
    getViewport(options: { scale: number; rotation?: number }): PageViewport;
    getTextContent(options?: {
      normalizeWhitespace?: boolean;
      disableCombineTextItems?: boolean;
    }): Promise<TextContent>;
    render(params: RenderParameters): RenderTask;
    cleanup(): void;
  }

  export interface PageViewport {
    width: number;
    height: number;
    scale: number;
    rotation: number;
    transform: number[];
    clone(options?: { scale?: number; rotation?: number }): PageViewport;
  }

  export interface TextContent {
    items: TextItem[];
    styles: Record<string, TextStyle>;
  }

  export interface TextItem {
    str: string;
    dir: string;
    transform: number[];
    width: number;
    height: number;
    fontName: string;
    hasEOL: boolean;
  }

  export interface TextStyle {
    fontFamily: string;
    ascent: number;
    descent: number;
    vertical: boolean;
  }

  export interface RenderParameters {
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewport;
    intent?: string;
    canvas?: HTMLCanvasElement;
  }

  export interface RenderTask {
    promise: Promise<void>;
    cancel(): void;
  }

  export interface DocumentInitParameters {
    url?: string;
    data?: Uint8Array | ArrayBuffer;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
  }

  export function getDocument(
    src: string | DocumentInitParameters
  ): PDFDocumentLoadingTask;

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
    destroy(): void;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export const version: string;
}
