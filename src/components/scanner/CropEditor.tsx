/**
 * Crop Editor
 *
 * Lets the user tighten a captured scan by dragging the four corner handles
 * (TC-MOB-021). Built on React Native's own PanResponder rather than
 * Reanimated/gesture-handler worklets: this project has no Reanimated Babel
 * plugin configured, so worklet callbacks would silently fall back to the JS
 * thread anyway. PanResponder keeps the dependency surface at zero.
 *
 * The crop rectangle is tracked in CONTAINER coordinates (what the user sees)
 * and converted to SOURCE PIXELS only when applying, because the preview is
 * letterboxed by `resizeMode: contain` and the two spaces differ by both a
 * scale factor and an offset.
 *
 * Note the crop is a rectangle, not a free quad. `expo-image-manipulator`
 * supports rectangular crop only — a four-point perspective transform needs a
 * different library (TC-MOB-022).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  PanResponder,
  ActivityIndicator,
  TouchableOpacity,
  LayoutChangeEvent,
  Alert,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { RotateCcw, Check, X, Crop as CropIcon } from 'lucide-react-native';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';

/** Side of the visible image kept clear so handles stay grabbable at the edges. */
const HANDLE = 32;
/** Smallest crop the user can drag to, in container points. */
const MIN_SIZE = 64;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface CropEditorProps {
  uri: string;
  onCancel: () => void;
  /** Called with the cropped image URI. */
  onDone: (uri: string) => void;
}

export function CropEditor({ uri, onCancel, onDone }: CropEditorProps) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const [container, setContainer] = useState<{ width: number; height: number } | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) setNatural({ width, height });
      },
      () => {
        if (!cancelled) Alert.alert('Error', 'Could not read this image.');
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  /**
   * Where the letterboxed image actually sits inside the container — the frame
   * the crop rectangle is clamped to.
   */
  const frame = useMemo(() => {
    if (!container || !natural) return null;
    const boxW = container.width - HANDLE;
    const boxH = container.height - HANDLE;
    const scale = Math.min(boxW / natural.width, boxH / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    return {
      x: (container.width - width) / 2,
      y: (container.height - height) / 2,
      width,
      height,
      scale,
    };
  }, [container, natural]);

  const fullRect = useCallback((): Rect | null => fullRectFrom(frame), [frame]);

  // The whole image is selected until the user drags, so "Apply" without any
  // adjustment is a no-op. Derived rather than seeded from an effect, which
  // would render one frame with no selection.
  const activeCrop = crop ?? fullRect();

  // Memoised rather than held in a ref: the responders must be stable across
  // renders (a new object mid-drag drops the gesture) but must also pick up a
  // new `frame` when the layout or image size resolves.
  const responders = useMemo(() => {
    const make = (corner: Corner) => {
      // `gesture.dx/dy` are cumulative from the start of the gesture, so the
      // previous values are kept per-responder and applied as increments to
      // the latest state. That avoids needing a ref to the crop rectangle.
      let lastDx = 0;
      let lastDy = 0;

      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lastDx = 0;
          lastDy = 0;
        },
        onPanResponderMove: (_evt, gesture) => {
          const dx = gesture.dx - lastDx;
          const dy = gesture.dy - lastDy;
          lastDx = gesture.dx;
          lastDy = gesture.dy;

          setCrop((current) => {
            // On the very first drag there is no stored rectangle yet — fall
            // back to the derived full-image selection.
            const prev = current ?? fullRectFrom(frame);
            if (!prev || !frame) return current;

            const next = { ...prev };
            const minL = frame.x;
            const minT = frame.y;
            const maxR = frame.x + frame.width;
            const maxB = frame.y + frame.height;

            if (corner === 'tl' || corner === 'bl') {
              next.left = clamp(prev.left + dx, minL, prev.right - MIN_SIZE);
            } else {
              next.right = clamp(prev.right + dx, prev.left + MIN_SIZE, maxR);
            }
            if (corner === 'tl' || corner === 'tr') {
              next.top = clamp(prev.top + dy, minT, prev.bottom - MIN_SIZE);
            } else {
              next.bottom = clamp(prev.bottom + dy, prev.top + MIN_SIZE, maxB);
            }

            return next;
          });
        },
      });
    };

    return { tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') };
  }, [frame]);

  const handleReset = () => {
    const full = fullRect();
    if (full) setCrop(full);
  };

  const handleApply = async () => {
    if (!activeCrop || !frame || !natural) return;

    // Container points -> source pixels. Rounded and clamped so a drag that
    // ends a fraction outside the frame can't produce an out-of-bounds crop,
    // which the native manipulator rejects.
    const { originX, originY, width, height } = toSourceCrop(activeCrop, frame, natural);

    setIsApplying(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      onDone(result.uri);
    } catch (error) {
      console.error('Crop failed:', error);
      Alert.alert('Error', 'Could not crop this image. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  };

  const ready = container && natural && frame && activeCrop;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel crop">
          <X size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <CropIcon size={18} color={COLORS.white} />
          <Text style={styles.headerTitle}>Crop Scan</Text>
        </View>
        <TouchableOpacity onPress={handleReset} accessibilityRole="button" accessibilityLabel="Reset crop">
          <RotateCcw size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.canvas} onLayout={onLayout}>
        {frame && (
          <Image
            source={{ uri }}
            style={{
              position: 'absolute',
              left: frame.x,
              top: frame.y,
              width: frame.width,
              height: frame.height,
            }}
            resizeMode="contain"
          />
        )}

        {ready && (
          <>
            {/* Dim everything outside the selection so the crop reads at a glance. */}
            <View style={[styles.shade, { left: 0, right: 0, top: 0, height: activeCrop.top }]} />
            <View style={[styles.shade, { left: 0, right: 0, top: activeCrop.bottom, bottom: 0 }]} />
            <View
              style={[
                styles.shade,
                { left: 0, width: activeCrop.left, top: activeCrop.top, height: activeCrop.bottom - activeCrop.top },
              ]}
            />
            <View
              style={[
                styles.shade,
                {
                  left: activeCrop.right,
                  right: 0,
                  top: activeCrop.top,
                  height: activeCrop.bottom - activeCrop.top,
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={[
                styles.selection,
                {
                  left: activeCrop.left,
                  top: activeCrop.top,
                  width: activeCrop.right - activeCrop.left,
                  height: activeCrop.bottom - activeCrop.top,
                },
              ]}
            />

            <CornerHandle x={activeCrop.left} y={activeCrop.top} responder={responders.tl} />
            <CornerHandle x={activeCrop.right} y={activeCrop.top} responder={responders.tr} />
            <CornerHandle x={activeCrop.left} y={activeCrop.bottom} responder={responders.bl} />
            <CornerHandle x={activeCrop.right} y={activeCrop.bottom} responder={responders.br} />
          </>
        )}

        {!ready && <ActivityIndicator size="large" color={COLORS.white} />}

        {isApplying && (
          <View style={styles.applyingOverlay}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.applyingText}>Cropping…</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>Drag the corners to trim the edges</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={handleReset} disabled={isApplying}>
            <RotateCcw size={22} color={COLORS.white} />
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleApply}
            disabled={isApplying || !ready}
          >
            <Check size={22} color={COLORS.white} />
            <Text style={styles.buttonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function CornerHandle({
  x,
  y,
  responder,
}: {
  x: number;
  y: number;
  responder: ReturnType<typeof PanResponder.create>;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      {...responder.panHandlers}
      style={[styles.handleHitArea, { left: x - HANDLE / 2, top: y - HANDLE / 2 }]}
    >
      <View style={styles.handleDot} />
    </View>
  );
}

/**
 * Convert a selection in container points to a crop in source pixels.
 * Exported for testing: the offset-and-scale conversion is the part most
 * likely to be subtly wrong, and it cannot be eyeballed on a device.
 */
export function toSourceCrop(
  crop: Rect,
  frame: { x: number; y: number; scale: number },
  natural: { width: number; height: number }
): { originX: number; originY: number; width: number; height: number } {
  const toSource = (v: number, offset: number) => (v - offset) / frame.scale;
  const originX = Math.round(clamp(toSource(crop.left, frame.x), 0, natural.width - 1));
  const originY = Math.round(clamp(toSource(crop.top, frame.y), 0, natural.height - 1));
  const width = Math.round(
    clamp(toSource(crop.right, frame.x) - originX, 1, natural.width - originX)
  );
  const height = Math.round(
    clamp(toSource(crop.bottom, frame.y) - originY, 1, natural.height - originY)
  );
  return { originX, originY, width, height };
}

/** The selection covering the whole visible image. */
export function fullRectFrom(frame: { x: number; y: number; width: number; height: number } | null): Rect | null {
  if (!frame) return null;
  return {
    left: frame.x,
    top: frame.y,
    right: frame.x + frame.width,
    bottom: frame.y + frame.height,
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  canvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  handleHitArea: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  applyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  applyingText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  hint: {
    color: COLORS.gray[300],
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: 4,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
});
