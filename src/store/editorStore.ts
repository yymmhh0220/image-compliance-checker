import { create } from 'zustand';
import type { EditorState, EditAction, Point } from '../types';

export interface EditorStoreState {
  // State
  editorState: EditorState | null;
  isCorrecting: boolean;

  // Actions
  initEditor: () => void;
  setTool: (tool: EditorState['tool']) => void;
  setBrushSize: (size: number) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: Point) => void;
  addAction: (action: EditAction) => void;
  undo: () => void;
  redo: () => void;
  resetEditor: () => void;
  setCorrecting: (isCorrecting: boolean) => void;
}

const createInitialEditorState = (): EditorState => ({
  tool: 'brush',
  brushSize: 20,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  history: [],
  historyIndex: -1,
});

export const useEditorStore = create<EditorStoreState>((set) => ({
  editorState: null,
  isCorrecting: false,

  initEditor: () =>
    set({ editorState: createInitialEditorState() }),

  setTool: (tool) =>
    set((state) => {
      if (!state.editorState) return state;
      return { editorState: { ...state.editorState, tool } };
    }),

  setBrushSize: (size) =>
    set((state) => {
      if (!state.editorState) return state;
      return { editorState: { ...state.editorState, brushSize: size } };
    }),

  setZoom: (zoom) =>
    set((state) => {
      if (!state.editorState) return state;
      return { editorState: { ...state.editorState, zoom } };
    }),

  setPanOffset: (offset) =>
    set((state) => {
      if (!state.editorState) return state;
      return { editorState: { ...state.editorState, panOffset: offset } };
    }),

  addAction: (action) =>
    set((state) => {
      if (!state.editorState) return state;
      // Discard any redo history beyond current index
      const newHistory = state.editorState.history.slice(0, state.editorState.historyIndex + 1);
      newHistory.push(action);
      return {
        editorState: {
          ...state.editorState,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        },
      };
    }),

  undo: () =>
    set((state) => {
      if (!state.editorState) return state;
      if (state.editorState.historyIndex < 0) return state;
      return {
        editorState: {
          ...state.editorState,
          historyIndex: state.editorState.historyIndex - 1,
        },
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.editorState) return state;
      if (state.editorState.historyIndex >= state.editorState.history.length - 1) return state;
      return {
        editorState: {
          ...state.editorState,
          historyIndex: state.editorState.historyIndex + 1,
        },
      };
    }),

  resetEditor: () =>
    set({ editorState: null }),

  setCorrecting: (isCorrecting) =>
    set({ isCorrecting }),
}));
