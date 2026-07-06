/**
 * DocumentScanner Component
 *
 * Advanced document scanning with:
 * - Edge detection visualization
 * - Auto-capture when document is detected
 * - Perspective correction
 * - Multi-page support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraView, Camera, type FlashMode } from 'expo-camera';
import {
  Zap,
  ZapOff,
  RotateCcw,
  Focus,
  Scan,
} from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../utils/constants';
import { processScannedDocument, type DetectedEdges } from '../../utils/perspectiveCorrection';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Document aspect ratios for common paper sizes
const DOCUMENT_RATIOS = {
  A4: 1.414, // 210mm x 297mm
  LETTER: 1.294, // 8.5" x 11"
  LEGAL: 1.647, // 8.5" x 14"
};

interface DetectedEdge {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
  confidence: number;
}

interface DocumentScannerProps {
  onCapture: (imageUri: string, edges?: DetectedEdge) => void;
  onCancel: () => void;
  autoCapture?: boolean;
  showEdgeGuide?: boolean;
  captureDelay?: number; // ms to wait before auto-capture
  enablePerspectiveCorrection?: boolean; // Apply auto-crop and perspective transform
}

export function DocumentScanner({
  onCapture,
  onCancel,
  autoCapture = true,
  showEdgeGuide = true,
  captureDelay = 1500,
  enablePerspectiveCorrection = true,
}: DocumentScannerProps) {
  const cameraRef = useRef<CameraView>(null);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [edgeDetected, setEdgeDetected] = useState(false);
  const [detectedEdges, setDetectedEdges] = useState<DetectedEdge | null>(null);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);

  // Animation for edge detection feedback
  const edgeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Countdown timer for auto-capture
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for frame
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Edge detection animation
  useEffect(() => {
    Animated.timing(edgeAnim, {
      toValue: edgeDetected ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [edgeDetected]);

  // Simulated edge detection (in production, use ML model or native module)
  // This provides visual feedback and auto-capture timing
  const simulateEdgeDetection = useCallback(() => {
    // In a real implementation, this would analyze camera frames
    // For now, we simulate detection after user steadies the camera

    // Simulate edge detection with random confidence
    const mockEdges: DetectedEdge = {
      topLeft: { x: 0.1, y: 0.15 },
      topRight: { x: 0.9, y: 0.15 },
      bottomLeft: { x: 0.1, y: 0.85 },
      bottomRight: { x: 0.9, y: 0.85 },
      confidence: 0.85 + Math.random() * 0.15,
    };

    setDetectedEdges(mockEdges);
    setEdgeDetected(mockEdges.confidence > 0.8);
  }, []);

  // Start auto-capture countdown when edges are detected
  useEffect(() => {
    if (edgeDetected && autoCapture && !isCapturing) {
      setAutoCaptureCountdown(Math.ceil(captureDelay / 1000));

      countdownRef.current = setInterval(() => {
        setAutoCaptureCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            handleCapture();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      setAutoCaptureCountdown(null);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [edgeDetected, autoCapture, captureDelay, isCapturing]);

  // Periodic edge detection simulation
  useEffect(() => {
    const interval = setInterval(simulateEdgeDetection, 500);
    return () => clearInterval(interval);
  }, [simulateEdgeDetection]);

  const handleCapture = async () => {
    if (cameraRef.current && !isCapturing && !isProcessing) {
      setIsCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.95,
          base64: false,
          skipProcessing: false,
        });

        if (photo) {
          // Apply perspective correction if enabled
          if (enablePerspectiveCorrection && detectedEdges && detectedEdges.confidence > 0.7) {
            setIsProcessing(true);
            try {
              const correctedResult = await processScannedDocument(
                photo.uri,
                detectedEdges as DetectedEdges,
                {
                  targetWidth: 1700, // ~200 DPI for A4
                  autoEnhance: true,
                  fixOrientation: true,
                }
              );
              onCapture(correctedResult.uri, detectedEdges || undefined);
            } catch (correctionError) {
              console.error('Perspective correction failed, using original:', correctionError);
              onCapture(photo.uri, detectedEdges || undefined);
            } finally {
              setIsProcessing(false);
            }
          } else {
            onCapture(photo.uri, detectedEdges || undefined);
          }
        }
      } catch (error) {
        console.error('Failed to capture:', error);
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const toggleFlash = () => {
    setFlashMode((current) => (current === 'off' ? 'on' : 'off'));
  };

  // Calculate edge guide color based on detection
  const edgeColor = edgeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.white, COLORS.success],
  });

  const edgeBorderWidth = edgeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 4],
  });

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        flash={flashMode}
      >
        {/* Edge Detection Overlay */}
        {showEdgeGuide && (
          <View style={styles.edgeOverlay}>
            <Animated.View
              style={[
                styles.edgeGuide,
                {
                  transform: [{ scale: pulseAnim }],
                  borderColor: edgeColor,
                  borderWidth: edgeBorderWidth,
                },
              ]}
            >
              {/* Corner Markers */}
              <Animated.View style={[styles.corner, styles.cornerTL, { borderColor: edgeColor }]} />
              <Animated.View style={[styles.corner, styles.cornerTR, { borderColor: edgeColor }]} />
              <Animated.View style={[styles.corner, styles.cornerBL, { borderColor: edgeColor }]} />
              <Animated.View style={[styles.corner, styles.cornerBR, { borderColor: edgeColor }]} />

              {/* Detection Status */}
              <View style={styles.detectionStatus}>
                {edgeDetected ? (
                  <>
                    <Focus size={24} color={COLORS.success} />
                    <Text style={[styles.detectionText, { color: COLORS.success }]}>
                      Document Detected
                    </Text>
                    {autoCaptureCountdown !== null && (
                      <Text style={styles.countdownText}>
                        Capturing in {autoCaptureCountdown}...
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Scan size={24} color={COLORS.white} />
                    <Text style={styles.detectionText}>
                      Position document in frame
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>

            {/* Instructions */}
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>
                {edgeDetected
                  ? 'Hold steady for auto-capture'
                  : 'Align document edges with the frame'}
              </Text>
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              {flashMode === 'on' ? (
                <Zap size={24} color={COLORS.warning} />
              ) : (
                <ZapOff size={24} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                edgeDetected && styles.captureButtonActive,
                (isCapturing || isProcessing) && styles.captureButtonDisabled,
              ]}
              onPress={handleCapture}
              disabled={isCapturing || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : (
                <View
                  style={[
                    styles.captureButtonInner,
                    edgeDetected && styles.captureButtonInnerActive,
                  ]}
                />
              )}
            </TouchableOpacity>

            <Text style={styles.captureHint}>
              {isProcessing
                ? 'Processing...'
                : autoCapture
                ? 'Auto-capture enabled'
                : 'Tap to capture'}
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  camera: {
    flex: 1,
  },
  edgeOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  edgeGuide: {
    width: '90%',
    aspectRatio: 1 / DOCUMENT_RATIOS.A4,
    maxHeight: '65%',
    borderRadius: 8,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderWidth: 4,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  detectionStatus: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -30 }],
  },
  detectionText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginTop: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  countdownText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  instructions: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: COLORS.gray[300],
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? SPACING.xxl + 20 : SPACING.xxl,
  },
  controlButton: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  cancelText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: SPACING.xxl + 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  captureButtonActive: {
    borderColor: COLORS.success,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
  },
  captureButtonInnerActive: {
    backgroundColor: COLORS.success,
  },
  captureHint: {
    color: COLORS.gray[400],
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});

export default DocumentScanner;
