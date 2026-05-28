import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import type { EditAction } from '../types';

/**
 * Helper to create a mock EditAction for testing.
 */
function createMockAction(type: 'brush' | 'eraser' | 'smartFill' = 'brush'): EditAction {
  const data = new Uint8ClampedArray(4 * 4 * 4); // 4x4 image
  return {
    type,
    points: [{ x: 1, y: 1 }],
    previousData: { width: 4, height: 4, data, colorSpace: 'srgb' } as ImageData,
  };
}

describe('editorStore - undo/redo', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().initEditor();
  });

  it('initial state has empty history and historyIndex at -1', () => {
    const state = useEditorStore.getState().editorState;
    expect(state).not.toBeNull();
    expect(state!.history).toEqual([]);
    expect(state!.historyIndex).toBe(-1);
  });

  it('adding an action updates history and historyIndex', () => {
    const action = createMockAction();
    useEditorStore.getState().addAction(action);

    const state = useEditorStore.getState().editorState!;
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toBe(action);
    expect(state.historyIndex).toBe(0);
  });

  it('adding multiple actions increments historyIndex correctly', () => {
    const action1 = createMockAction('brush');
    const action2 = createMockAction('eraser');
    const action3 = createMockAction('smartFill');

    useEditorStore.getState().addAction(action1);
    useEditorStore.getState().addAction(action2);
    useEditorStore.getState().addAction(action3);

    const state = useEditorStore.getState().editorState!;
    expect(state.history).toHaveLength(3);
    expect(state.historyIndex).toBe(2);
  });

  it('undo decrements historyIndex', () => {
    const action1 = createMockAction();
    const action2 = createMockAction();

    useEditorStore.getState().addAction(action1);
    useEditorStore.getState().addAction(action2);
    useEditorStore.getState().undo();

    const state = useEditorStore.getState().editorState!;
    expect(state.historyIndex).toBe(0);
    // History is preserved
    expect(state.history).toHaveLength(2);
  });

  it('redo increments historyIndex', () => {
    const action1 = createMockAction();
    const action2 = createMockAction();

    useEditorStore.getState().addAction(action1);
    useEditorStore.getState().addAction(action2);
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();

    const state = useEditorStore.getState().editorState!;
    expect(state.historyIndex).toBe(1);
  });

  it('undo at beginning (historyIndex = -1) does nothing', () => {
    // No actions added, historyIndex is -1
    useEditorStore.getState().undo();

    const state = useEditorStore.getState().editorState!;
    expect(state.historyIndex).toBe(-1);
    expect(state.history).toHaveLength(0);
  });

  it('undo at historyIndex 0 decrements to -1', () => {
    const action = createMockAction();
    useEditorStore.getState().addAction(action);
    useEditorStore.getState().undo();

    const state = useEditorStore.getState().editorState!;
    expect(state.historyIndex).toBe(-1);
    expect(state.history).toHaveLength(1);
  });

  it('redo at end (historyIndex = history.length - 1) does nothing', () => {
    const action = createMockAction();
    useEditorStore.getState().addAction(action);

    // historyIndex is already at the end (0 = history.length - 1)
    useEditorStore.getState().redo();

    const state = useEditorStore.getState().editorState!;
    expect(state.historyIndex).toBe(0);
  });

  it('redo with no history does nothing', () => {
    // No actions, historyIndex = -1, history.length - 1 = -1
    useEditorStore.getState().redo();

    const state = useEditorStore.getState().editorState!;
    expect(state.historyIndex).toBe(-1);
    expect(state.history).toHaveLength(0);
  });

  it('adding action after undo discards redo history', () => {
    const action1 = createMockAction('brush');
    const action2 = createMockAction('eraser');
    const action3 = createMockAction('smartFill');

    useEditorStore.getState().addAction(action1);
    useEditorStore.getState().addAction(action2);
    useEditorStore.getState().addAction(action3);

    // Undo twice: historyIndex goes from 2 -> 1 -> 0
    useEditorStore.getState().undo();
    useEditorStore.getState().undo();

    // Add a new action - should discard action2 and action3
    const newAction = createMockAction('brush');
    useEditorStore.getState().addAction(newAction);

    const state = useEditorStore.getState().editorState!;
    expect(state.history).toHaveLength(2);
    expect(state.history[0]).toBe(action1);
    expect(state.history[1]).toBe(newAction);
    expect(state.historyIndex).toBe(1);
  });

  it('multiple undo/redo cycles work correctly', () => {
    const action1 = createMockAction('brush');
    const action2 = createMockAction('eraser');
    const action3 = createMockAction('smartFill');

    useEditorStore.getState().addAction(action1);
    useEditorStore.getState().addAction(action2);
    useEditorStore.getState().addAction(action3);

    // Undo all the way back
    useEditorStore.getState().undo(); // index: 2 -> 1
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(1);

    useEditorStore.getState().undo(); // index: 1 -> 0
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(0);

    useEditorStore.getState().undo(); // index: 0 -> -1
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(-1);

    // Extra undo does nothing
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(-1);

    // Redo all the way forward
    useEditorStore.getState().redo(); // index: -1 -> 0
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(0);

    useEditorStore.getState().redo(); // index: 0 -> 1
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(1);

    useEditorStore.getState().redo(); // index: 1 -> 2
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(2);

    // Extra redo does nothing
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().editorState!.historyIndex).toBe(2);

    // History is fully preserved
    expect(useEditorStore.getState().editorState!.history).toHaveLength(3);
  });

  it('undo/redo does nothing when editor is not initialized', () => {
    useEditorStore.getState().resetEditor();

    // Should not throw
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();

    expect(useEditorStore.getState().editorState).toBeNull();
  });

  it('addAction does nothing when editor is not initialized', () => {
    useEditorStore.getState().resetEditor();

    const action = createMockAction();
    useEditorStore.getState().addAction(action);

    expect(useEditorStore.getState().editorState).toBeNull();
  });
});
