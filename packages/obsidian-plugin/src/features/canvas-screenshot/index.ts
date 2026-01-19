import { type } from "arktype";
import type { Request, Response } from "express";
import { Notice, TFile } from "obsidian";
// Use AC's bundled html-to-image which properly captures SVG properties
// The npm version caches style properties from document.documentElement, missing fill/stroke
import { toPng, clearCaches } from "./html-to-image-ac";
import { LocalRestAPI } from "shared";
import type McpToolsPlugin from "../../main";
import { logger } from "../../shared/logger";
import {
  type BBox,
  type Canvas,
  type CanvasEdge,
  type CanvasNode,
  type CanvasView,
  isCanvasView,
} from "./types";

// Maximum time to wait for nodes to load (ms)
const MAX_LOADING_TIME = 15000;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create interaction blocker element exactly like Advanced Canvas getInteractionBlocker (lines 6907-6929)
 * This creates a visual overlay that blocks interaction during export
 */
function createInteractionBlocker(): HTMLElement {
  const interactionBlocker = document.createElement("div");
  interactionBlocker.classList.add("progress-bar-container");

  const progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");
  interactionBlocker.appendChild(progressBar);

  const progressBarMessage = document.createElement("div");
  progressBarMessage.classList.add("progress-bar-message", "u-center-text");
  progressBarMessage.innerText = "Generating image...";
  progressBar.appendChild(progressBarMessage);

  const progressBarIndicator = document.createElement("div");
  progressBarIndicator.classList.add("progress-bar-indicator");
  progressBar.appendChild(progressBarIndicator);

  const progressBarLine = document.createElement("div");
  progressBarLine.classList.add("progress-bar-line");
  progressBarIndicator.appendChild(progressBarLine);

  const progressBarSublineIncrease = document.createElement("div");
  progressBarSublineIncrease.classList.add("progress-bar-subline", "mod-increase");
  progressBarIndicator.appendChild(progressBarSublineIncrease);

  const progressBarSublineDecrease = document.createElement("div");
  progressBarSublineDecrease.classList.add("progress-bar-subline", "mod-decrease");
  progressBarIndicator.appendChild(progressBarSublineDecrease);

  return interactionBlocker;
}

/**
 * Get canvas from an open canvas file
 */
function getCanvasForFile(
  plugin: McpToolsPlugin,
  filename: string,
): Canvas | null {
  const leaves = plugin.app.workspace.getLeavesOfType("canvas");

  for (const leaf of leaves) {
    const view = leaf.view as CanvasView;
    if (view?.file?.path === filename && isCanvasView(view)) {
      return view.canvas;
    }
  }

  return null;
}

/**
 * Calculate bounding box for all canvas elements (nodes AND edges)
 * Uses getBBox() method on each element like Advanced Canvas does
 */
function calculateBoundingBox(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): BBox {
  const bboxes: BBox[] = [];

  // Get node bboxes - try getBBox() first, fallback to coordinates
  for (const node of nodes) {
    try {
      if (typeof node.getBBox === "function") {
        const bbox = node.getBBox();
        if (bbox) {
          bboxes.push(bbox);
          continue;
        }
      }
    } catch {
      // Fall through to coordinate-based approach
    }
    // Fallback: use node coordinates directly
    bboxes.push({
      minX: node.x,
      minY: node.y,
      maxX: node.x + node.width,
      maxY: node.y + node.height,
    });
  }

  // Get edge bboxes - try getBBox() if available
  for (const edge of edges) {
    try {
      if (typeof edge.getBBox === "function") {
        const bbox = edge.getBBox();
        if (bbox) {
          bboxes.push(bbox);
        }
      }
    } catch {
      // Edges without getBBox are OK - they're usually within node bounds
    }
  }

  return combineBBoxes(bboxes);
}

/**
 * Scale a bounding box by a factor (1.1 = 10% larger)
 * Matches Advanced Canvas BBoxHelper.scaleBBox
 */
function scaleBBox(bbox: BBox, scale: number): BBox {
  const diffX = (scale - 1) * (bbox.maxX - bbox.minX);
  const diffY = (scale - 1) * (bbox.maxY - bbox.minY);
  return {
    minX: bbox.minX - diffX / 2,
    maxX: bbox.maxX + diffX / 2,
    minY: bbox.minY - diffY / 2,
    maxY: bbox.maxY + diffY / 2,
  };
}

/**
 * Add padding to a bounding box (absolute value on all sides)
 * Matches Advanced Canvas BBoxHelper.enlargeBBox
 */
function enlargeBBox(bbox: BBox, padding: number): BBox {
  return {
    minX: bbox.minX - padding,
    minY: bbox.minY - padding,
    maxX: bbox.maxX + padding,
    maxY: bbox.maxY + padding,
  };
}


/**
 * Extract scale value from canvas transform style
 */
function extractCanvasScale(canvasEl: HTMLElement): number {
  const transform = canvasEl.style.transform;
  const match = transform.match(/scale\((\d+(?:\.\d+)?)\)/);
  return match ? parseFloat(match[1]) : 1;
}

/**
 * Zoom to a bounding box without clamping (like Advanced Canvas's zoomToRealBbox)
 * When screenshotting, this allows zooming out beyond normal limits
 * Uses canvas.zoomToRealBbox if available (Advanced Canvas installed), otherwise manual implementation
 */
function zoomToRealBbox(canvas: Canvas, bbox: BBox): void {
  // If Advanced Canvas has added zoomToRealBbox to the canvas, use it directly
  if (typeof canvas.zoomToRealBbox === "function") {
    logger.debug("zoomToRealBbox: using Advanced Canvas method");
    canvas.zoomToRealBbox(bbox);
    return;
  }

  // Fallback: manual implementation matching Advanced Canvas behavior
  logger.debug("zoomToRealBbox: using fallback implementation");

  const canvasRect = canvas.canvasRect;
  if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) {
    logger.warn("zoomToRealBbox: canvasRect not available");
    return;
  }

  const bboxWidth = bbox.maxX - bbox.minX;
  const bboxHeight = bbox.maxY - bbox.minY;
  if (bboxWidth <= 0 || bboxHeight <= 0) {
    logger.warn("zoomToRealBbox: invalid bbox dimensions");
    return;
  }

  const widthZoom = canvasRect.width / bboxWidth;
  const heightZoom = canvasRect.height / bboxHeight;

  // When screenshotting, don't clamp zoom - allows zooming out further than normal
  const zoom = canvas.screenshotting
    ? Math.min(widthZoom, heightZoom)
    : Math.min(Math.min(widthZoom, heightZoom), 1);

  canvas.tZoom = Math.log2(zoom);
  canvas.zoomCenter = null;
  canvas.tx = (bbox.minX + bbox.maxX) / 2;
  canvas.ty = (bbox.minY + bbox.maxY) / 2;
  canvas.markViewportChanged();
}


/**
 * Combine multiple bounding boxes into one that contains them all
 * EXACTLY matches Advanced Canvas BBoxHelper.combineBBoxes
 * Returns Infinity values for empty arrays (which don't affect results when combined)
 */
function combineBBoxes(bboxes: BBox[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const bbox of bboxes) {
    minX = Math.min(minX, bbox.minX);
    minY = Math.min(minY, bbox.minY);
    maxX = Math.max(maxX, bbox.maxX);
    maxY = Math.max(maxY, bbox.maxY);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Wait for all canvas nodes to finish loading
 * Checks node.initialized and node.isContentMounted like Advanced Canvas does
 * Returns the list of unloaded nodes (empty if all loaded)
 * Uses 10ms intervals exactly like Advanced Canvas (lines 6841-6847)
 */
async function waitForNodesReady(
  nodes: CanvasNode[],
  maxWait = MAX_LOADING_TIME,
): Promise<CanvasNode[]> {
  let unloadedNodes = nodes.filter(
    (node) => node.initialized === false || node.isContentMounted === false,
  );
  const startTime = performance.now();

  while (unloadedNodes.length > 0 && performance.now() - startTime < maxWait) {
    await sleep(10); // Exactly 10ms like Advanced Canvas
    unloadedNodes = nodes.filter(
      (node) => node.initialized === false || node.isContentMounted === false,
    );
    logger.debug(`Waiting for ${unloadedNodes.length} nodes to finish loading...`);
  }

  if (unloadedNodes.length === 0) {
    logger.debug("All canvas nodes loaded");
  } else {
    logger.warn("Some canvas nodes did not finish loading within timeout");
  }

  return unloadedNodes;
}

/**
 * Get canvas background color from CSS (same as Advanced Canvas)
 */
function getCanvasBackgroundColor(canvasEl: HTMLElement): string {
  const bg = window.getComputedStyle(canvasEl).getPropertyValue("--canvas-background");
  if (bg && bg.trim()) {
    return bg.trim();
  }
  // Fallback based on theme
  return document.body.classList.contains("theme-dark") ? "#1e1e1e" : "#ffffff";
}

/**
 * Capture canvas as PNG base64
 * EXACTLY matches Advanced Canvas export approach (lines 6780-6899)
 */
async function captureCanvasAsImage(canvas: Canvas): Promise<string> {
  const nodes = Array.from(canvas.nodes.values());
  const edges = Array.from(canvas.edges.values());

  if (nodes.length === 0) {
    throw new Error("Canvas has no nodes to capture");
  }

  // === SETUP (Advanced Canvas lines 6787-6797) ===
  // Order EXACTLY matches AC: backgroundColor, interactionBlocker, screenshotting, is-exporting, selection, viewport

  // 1. Get background color (line 6787)
  const backgroundColor = window
    .getComputedStyle(canvas.canvasEl)
    .getPropertyValue("--canvas-background");

  // 2. Show Notice exactly like AC (line 6788)
  new Notice("Exporting the canvas. Please wait...");

  // 3. Create and append interactionBlocker to document.body (lines 6789-6790)
  const interactionBlocker = createInteractionBlocker();
  document.body.appendChild(interactionBlocker);

  // 3. Set screenshotting flag (line 6791)
  canvas.screenshotting = true;

  // 4. Add is-exporting class (line 6792)
  canvas.canvasEl.classList.add("is-exporting");

  // 5. Save and clear selection (lines 6795-6796)
  const cachedSelection = new Set(canvas.selection);
  canvas.deselectAll();

  // 6. Save viewport (line 6797)
  const cachedViewport = { x: canvas.x, y: canvas.y, zoom: canvas.zoom };

  try {
    // === STEP 1: Calculate bbox from nodes AND edges (line 6799) ===
    const targetBBox = calculateBoundingBox(nodes, edges);

    // === STEP 2: Scale bbox by 1.1 (line 6800) ===
    let enlargedBBox = scaleBBox(targetBBox, 1.1);

    // === STEP 3: Calculate pixel ratio (lines 6801-6804) ===
    const enlargedSize = {
      width: enlargedBBox.maxX - enlargedBBox.minX,
      height: enlargedBBox.maxY - enlargedBBox.minY,
    };
    const canvasElSize = {
      width: canvas.canvasEl.clientWidth,
      height: canvas.canvasEl.clientHeight,
    };
    const requiredPixelRatio = Math.max(
      enlargedSize.width / canvasElSize.width,
      enlargedSize.height / canvasElSize.height,
    );
    const pixelRatio = Math.round(requiredPixelRatio * 1); // pixelRatioFactor = 1

    // === STEP 4: Adjust bbox for canvas aspect ratio (lines 6807-6818) ===
    // CRITICAL: Expand from minX/minY (top-left), NOT centered!
    const actualAspectRatio = canvas.canvasRect.width / canvas.canvasRect.height;
    const targetAspectRatio = enlargedSize.width / enlargedSize.height;

    let adjustedBBox = { ...enlargedBBox };
    if (actualAspectRatio > targetAspectRatio) {
      // Canvas is wider - expand bbox width FROM minX (not centered!)
      const targetHeight = enlargedBBox.maxY - enlargedBBox.minY;
      const actualWidth = targetHeight * actualAspectRatio;
      adjustedBBox.maxX = enlargedBBox.minX + actualWidth;
    } else {
      // Canvas is taller - expand bbox height FROM minY (not centered!)
      const targetWidth = enlargedBBox.maxX - enlargedBBox.minX;
      const actualHeight = targetWidth / actualAspectRatio;
      adjustedBBox.maxY = enlargedBBox.minY + actualHeight;
    }

    logger.debug("Canvas bbox", {
      target: targetBBox,
      enlarged: enlargedBBox,
      adjusted: adjustedBBox,
      actualAspectRatio,
      targetAspectRatio,
      pixelRatio,
    });

    // === STEP 5: First zoom (lines 6819-6821) ===
    zoomToRealBbox(canvas, adjustedBBox);
    canvas.setViewport(canvas.tx, canvas.ty, canvas.tZoom);
    await sleep(10); // EXACTLY 10ms like AC

    // === STEP 6: Include edge labels in bbox (lines 6822-6833) ===
    // EXACTLY as Advanced Canvas does - no filtering, always do second zoom
    let canvasScale = extractCanvasScale(canvas.canvasEl);
    const edgePathsBBox = combineBBoxes(
      edges.map((edge) => {
        const edgeCenter = edge.getCenter();
        const labelWidth = edge.labelElement
          ? edge.labelElement.wrapperEl.getBoundingClientRect().width / canvasScale
          : 0;
        return {
          minX: edgeCenter.x - labelWidth / 2,
          minY: edgeCenter.y,
          maxX: edgeCenter.x + labelWidth / 2,
          maxY: edgeCenter.y,
        };
      }),
    );
    const enlargedEdgePathsBBox = enlargeBBox(edgePathsBBox, 1.1);
    enlargedBBox = combineBBoxes([enlargedBBox, enlargedEdgePathsBBox]);
    adjustedBBox = combineBBoxes([adjustedBBox, enlargedEdgePathsBBox]);

    // Second zoom with edge labels included (always done, not conditional)
    zoomToRealBbox(canvas, adjustedBBox);
    canvas.setViewport(canvas.tx, canvas.ty, canvas.tZoom);
    await sleep(10); // EXACTLY 10ms like AC

    // === STEP 7: Calculate final dimensions (lines 6834-6840) ===
    const canvasViewportBBox = canvas.getViewportBBox();
    canvasScale = extractCanvasScale(canvas.canvasEl);

    let width =
      (canvasViewportBBox.maxX - canvasViewportBBox.minX) * canvasScale;
    let height =
      (canvasViewportBBox.maxY - canvasViewportBBox.minY) * canvasScale;

    // Adjust to target aspect ratio (exactly as Advanced Canvas does)
    if (actualAspectRatio > targetAspectRatio) {
      width = height * targetAspectRatio;
    } else {
      height = width / targetAspectRatio;
    }

    logger.debug("Canvas capture dimensions", {
      width,
      height,
      canvasScale,
      viewportBBox: canvasViewportBBox,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });

    // === STEP 8: Wait for nodes to load (lines 6841-6847) ===
    const unloadedNodes = await waitForNodesReady(nodes);

    // === STEP 9: Gate on nodes loaded (lines 6848-6892) ===
    // EXACTLY like AC: only capture if ALL nodes finished loading
    if (unloadedNodes.length > 0) {
      throw new Error("Export cancelled: Nodes did not finish loading in time");
    }

    // === STEP 10: Build filter function (lines 6849-6864) ===
    // EXACTLY as Advanced Canvas does - get specific elements to include
    const nodeElements = nodes.map((node) => node.nodeEl);
    const edgePathAndArrowElements = edges
      .map((edge) => [edge.lineGroupEl, edge.lineEndGroupEl])
      .flat();
    const edgeLabelElements = edges
      .map((edge) => edge.labelElement?.wrapperEl)
      .filter((el): el is HTMLElement => el !== undefined);

    const filter = (element: Element): boolean => {
      // Exclude nodes not in our list
      if (
        element.classList?.contains("canvas-node") &&
        !nodeElements.includes(element as HTMLElement)
      ) {
        return false;
      }
      // Exclude edge elements not in our list
      if (
        element.parentElement?.classList?.contains("canvas-edges") &&
        !edgePathAndArrowElements.includes(element as SVGElement)
      ) {
        return false;
      }
      // Exclude edge labels not in our list
      if (
        element.classList?.contains("canvas-path-label-wrapper") &&
        !edgeLabelElements.includes(element as HTMLElement)
      ) {
        return false;
      }
      return true;
    };

    // === STEP 11: Capture (lines 6865-6873) ===
    // EXACTLY as Advanced Canvas does - using AC's bundled html-to-image
    const dataUrl = await toPng(canvas.canvasEl, {
      pixelRatio,
      backgroundColor,
      height,
      width,
      filter,
    });

    return dataUrl.split(",")[1];
  } finally {
    // === CLEANUP (lines 6893-6900) ===
    // EXACTLY like AC: set screenshotting to false (not restore), remove is-exporting, restore selection, restore viewport, remove blocker
    canvas.screenshotting = false; // AC sets to false, not restore
    canvas.canvasEl.classList.remove("is-exporting");
    canvas.updateSelection(() => {
      canvas.selection = cachedSelection;
    });
    canvas.setViewport(cachedViewport.x, cachedViewport.y, cachedViewport.zoom);
    interactionBlocker.remove();
  }
}

/**
 * Handle canvas screenshot request
 */
export async function handleCanvasScreenshot(
  plugin: McpToolsPlugin,
  req: Request,
  res: Response,
): Promise<void> {
  // Create interaction blocker EARLY to prevent user interaction during entire process
  const interactionBlocker = createInteractionBlocker();
  document.body.appendChild(interactionBlocker);

  try {
    // Validate request body
    const params = LocalRestAPI.ApiCanvasScreenshotParams(req.body);

    if (params instanceof type.errors) {
      res.status(400).json({
        error: "Invalid request body",
        summary: params.summary,
      });
      return;
    }

    const { filename, timeout = 1000 } = params;
    logger.debug("Screenshot params", { filename, timeout });

    // Validate file exists and is a canvas
    const file = plugin.app.vault.getAbstractFileByPath(filename);
    if (!(file instanceof TFile)) {
      res.status(404).json({
        error: `File not found: ${filename}`,
      });
      return;
    }

    if (file.extension !== "canvas") {
      res.status(400).json({
        error: `File is not a canvas file: ${filename}`,
      });
      return;
    }

    // Check if canvas is already open and get its leaf
    let canvas: Canvas | null = null;
    let canvasLeaf: ReturnType<typeof plugin.app.workspace.getLeavesOfType>[0] | null = null;

    const leaves = plugin.app.workspace.getLeavesOfType("canvas");
    for (const leaf of leaves) {
      const view = leaf.view as CanvasView;
      if (view?.file?.path === filename && isCanvasView(view)) {
        canvas = view.canvas;
        canvasLeaf = leaf;
        break;
      }
    }

    // If not open, open it in a new tab first
    if (!canvas) {
      logger.debug("Opening canvas file in new tab", { filename });

      // Open the file in a new leaf
      canvasLeaf = plugin.app.workspace.getLeaf(true);
      await canvasLeaf.openFile(file);

      // Wait for the view to initialize
      await sleep(timeout);

      // Try to get the canvas again
      const view = canvasLeaf.view as CanvasView;
      if (isCanvasView(view)) {
        canvas = view.canvas;
      }

      if (!canvas) {
        res.status(500).json({
          error: "Failed to open canvas view",
        });
        return;
      }
    }

    // CRITICAL: Activate the leaf so the canvas renders with proper dimensions
    // Must focus: true to ensure canvas fully renders (like when user manually views it)
    if (canvasLeaf) {
      plugin.app.workspace.setActiveLeaf(canvasLeaf, { focus: true });
      plugin.app.workspace.revealLeaf(canvasLeaf);
      await sleep(timeout); // Wait for layout to fully update
    }

    // Capture the image (handles zooming, waiting for nodes, and screenshot mode internally)
    // Note: captureCanvasAsImage creates its own interaction blocker for the capture phase,
    // but we keep ours up for the entire process including file opening
    const nodes = Array.from(canvas.nodes.values());
    const edges = Array.from(canvas.edges.values());
    logger.debug(`Canvas ready: ${nodes.length} nodes, ${edges.length} edges`);
    const imageBase64 = await captureCanvasAsImage(canvas);

    // Return the image
    res.json({
      image: imageBase64,
      mimeType: "image/png",
    } satisfies LocalRestAPI.ApiCanvasScreenshotResponseType);

    logger.info("Canvas screenshot captured successfully", { filename });
  } catch (error) {
    logger.error("Canvas screenshot error:", {
      error: error instanceof Error ? error.message : error,
      body: req.body,
    });
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to capture canvas",
    });
  } finally {
    // Always remove the interaction blocker
    interactionBlocker.remove();
  }
}

/**
 * Setup function - currently just logs initialization
 * Endpoint registration happens in main.ts after Local REST API is available
 */
export async function setup(plugin: McpToolsPlugin): Promise<void> {
  logger.info("Canvas screenshot feature loaded");
}

/**
 * Cleanup function to clear html-to-image caches
 * Should be called from plugin's onunload()
 */
export function cleanup(): void {
  clearCaches();
  logger.info("Canvas screenshot caches cleared");
}
