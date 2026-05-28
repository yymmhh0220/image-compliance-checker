import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Button, Slider, Tooltip, Space, Divider } from 'antd';
import {
  EditOutlined,
  ClearOutlined,
  BgColorsOutlined,
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';
import { applyBrushStroke } from '../../core/editor/brushTool';
import { applyEraserStroke } from '../../core/editor/eraserTool';
import { applySmartFill } from '../../core/editor/smartFill';
import type { EditorProps, Point, ViolationMarker } from '../../types';

const EditorCanvas: React.FC<EditorProps> = ({
  imageData,
  violations,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    editorState,
    initEditor,
    setTool,
    setBrushSize,
    setZoom,
    setPanOffset,
    addAction,
    undo,
    redo,
    resetEditor,
  } = useEditorStore();

  // Local state for drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [currentImageData, setCurrentImageData] = useState<ImageData>(imageData);
  const [originalImageData] = useState<ImageData>(imageData);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point>({ x: 0, y: 0 });

  // Initialize editor state on mount
  useEffect(() => {
    initEditor();
    return () => {
      resetEditor();
    };
  }, [initEditor, resetEditor]);

  // Render canvas whenever image data or editor state changes
  useEffect(() => {
    renderCanvas();
  }, [currentImageData, editorState?.zoom, editorState?.panOffset, violations]);

  // Replay history when undo/redo changes historyIndex
  useEffect(() => {
    if (!editorState) return;
    replayHistory();
  }, [editorState?.historyIndex]);

  const replayHistory = useCallback(() => {
    if (!editorState) return;

    // Start from original image and replay actions up to historyIndex
    let replayedData = new ImageData(
      new Uint8ClampedArray(originalImageData.data),
      originalImageData.width,
      originalImageData.height
    );

    for (let i = 0; i <= editorState.historyIndex; i++) {
      const action = editorState.history[i];
      if (action.type === 'brush') {
        const result = applyBrushStroke(replayedData, action.points, editorState.brushSize);
        replayedData = result.newImageData;
      } else if (action.type === 'eraser') {
        const result = applyEraserStroke(replayedData, originalImageData, action.points, editorState.brushSize);
        replayedData = result.newImageData;
      } else if (action.type === 'smartFill' && action.region) {
        const result = applySmartFill(replayedData, action.region);
        replayedData = result.newImageData;
      }
    }

    setCurrentImageData(replayedData);
  }, [editorState, originalImageData]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editorState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { zoom, panOffset } = editorState;

    // Set canvas size to match container
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform (zoom and pan)
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentImageData.width;
    tempCanvas.height = currentImageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(currentImageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    // Draw violation markers
    drawViolationMarkers(ctx, violations);

    ctx.restore();
  }, [currentImageData, editorState, violations]);

  const drawViolationMarkers = (ctx: CanvasRenderingContext2D, markers: ViolationMarker[]) => {
    markers.forEach((marker) => {
      const { boundingBox } = marker;

      // Draw highlight rectangle
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);

      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.fillRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);

      // Draw label
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.font = '12px sans-serif';
      const labelWidth = ctx.measureText(marker.label).width + 8;
      ctx.fillRect(boundingBox.x, boundingBox.y - 18, labelWidth, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(marker.label, boundingBox.x + 4, boundingBox.y - 5);
    });
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas || !editorState) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const { zoom, panOffset } = editorState;

    // Convert screen coordinates to image coordinates
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;

    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editorState) return;

    // Middle mouse button or space+click for panning
    if (e.button === 1) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return;

    const point = getCanvasPoint(e);

    if (editorState.tool === 'smartFill') {
      // Smart fill applies on click (single point starts region selection)
      // For simplicity, apply smart fill in a circular region around click
      const radius = editorState.brushSize;
      const region = {
        points: generateCirclePoints(point, radius),
      };
      const result = applySmartFill(currentImageData, region);
      setCurrentImageData(result.newImageData);
      addAction({
        type: 'smartFill',
        points: [point],
        region,
        previousData: result.previousData,
      });
      return;
    }

    setIsDrawing(true);
    setCurrentStroke([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editorState) return;

    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      setPanOffset({
        x: editorState.panOffset.x + dx,
        y: editorState.panOffset.y + dy,
      });
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDrawing) return;

    const point = getCanvasPoint(e);
    setCurrentStroke((prev) => [...prev, point]);

    // Live preview: apply tool at current point
    if (editorState.tool === 'brush') {
      const result = applyBrushStroke(currentImageData, [point], editorState.brushSize);
      setCurrentImageData(result.newImageData);
    } else if (editorState.tool === 'eraser') {
      const result = applyEraserStroke(currentImageData, originalImageData, [point], editorState.brushSize);
      setCurrentImageData(result.newImageData);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing || !editorState) return;

    setIsDrawing(false);

    if (currentStroke.length > 0) {
      // Record the complete stroke as a single action
      addAction({
        type: editorState.tool,
        points: currentStroke,
        previousData: originalImageData, // Simplified: store original for undo replay
      });
    }

    setCurrentStroke([]);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!editorState) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5, editorState.zoom + delta));
    setZoom(newZoom);
  };

  const handleZoomIn = () => {
    if (!editorState) return;
    const newZoom = Math.min(5, editorState.zoom + 0.25);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    if (!editorState) return;
    const newZoom = Math.max(0.1, editorState.zoom - 0.25);
    setZoom(newZoom);
  };

  const handleSave = () => {
    onSave(currentImageData);
  };

  const handleCancel = () => {
    onCancel();
  };

  const generateCirclePoints = (center: Point, radius: number): Point[] => {
    const points: Point[] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    return points;
  };

  if (!editorState) {
    return null;
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-white border-b border-gray-200 shadow-sm flex-wrap">
        <Space size="small">
          {/* Tool buttons */}
          <Tooltip title={t('editor.brush')}>
            <Button
              type={editorState.tool === 'brush' ? 'primary' : 'default'}
              icon={<EditOutlined />}
              onClick={() => setTool('brush')}
            />
          </Tooltip>
          <Tooltip title={t('editor.eraser')}>
            <Button
              type={editorState.tool === 'eraser' ? 'primary' : 'default'}
              icon={<ClearOutlined />}
              onClick={() => setTool('eraser')}
            />
          </Tooltip>
          <Tooltip title={t('editor.smartFill')}>
            <Button
              type={editorState.tool === 'smartFill' ? 'primary' : 'default'}
              icon={<BgColorsOutlined />}
              onClick={() => setTool('smartFill')}
            />
          </Tooltip>
        </Space>

        <Divider type="vertical" className="h-6" />

        {/* Undo/Redo */}
        <Space size="small">
          <Tooltip title={t('editor.undo')}>
            <Button
              icon={<UndoOutlined />}
              onClick={undo}
              disabled={editorState.historyIndex < 0}
            />
          </Tooltip>
          <Tooltip title={t('editor.redo')}>
            <Button
              icon={<RedoOutlined />}
              onClick={redo}
              disabled={editorState.historyIndex >= editorState.history.length - 1}
            />
          </Tooltip>
        </Space>

        <Divider type="vertical" className="h-6" />

        {/* Brush size slider */}
        <div className="flex items-center gap-2 min-w-[150px]">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {editorState.brushSize}px
          </span>
          <Slider
            min={1}
            max={100}
            value={editorState.brushSize}
            onChange={(value) => setBrushSize(value)}
            className="flex-1"
          />
        </div>

        <Divider type="vertical" className="h-6" />

        {/* Zoom controls */}
        <Space size="small">
          <Tooltip title={t('editor.zoomOut')}>
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          </Tooltip>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">
            {Math.round(editorState.zoom * 100)}%
          </span>
          <Tooltip title={t('editor.zoomIn')}>
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Tooltip>
        </Space>

        <Divider type="vertical" className="h-6" />

        {/* Save/Cancel */}
        <Space size="small" className="ml-auto">
          <Button onClick={handleCancel} icon={<CloseOutlined />}>
            {t('editor.cancel')}
          </Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>
            {t('editor.save')}
          </Button>
        </Space>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
};

export default EditorCanvas;
