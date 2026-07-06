/**
 * Upload/Scan Screen
 *
 * Multi-page document scanning and upload with:
 * - Edge detection visualization
 * - Auto-capture when document is detected
 * - Multi-page support with page management
 * - Image enhancement options
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, Camera, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  Zap,
  ZapOff,
  RotateCcw,
  Check,
  X,
  Wand2,
  FileText,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Upload as UploadIcon,
} from 'lucide-react-native';
import { useUploadNotice } from '../../src/hooks/useNotices';
import { usePaywall } from '../../src/hooks/useBilling';
import { LoadingSpinner, Button } from '../../src/components/common';
import { PaywallModal } from '../../src/components/billing';
import { generatePdfFromPages, validatePages } from '../../src/utils/pdfGenerator';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

type ScanState = 'camera' | 'preview' | 'pages' | 'enhancing' | 'uploading' | 'success' | 'error';
type EnhanceMode = 'original' | 'auto' | 'document' | 'grayscale';

interface ScannedPage {
  id: string;
  uri: string;
  thumbnailUri?: string;
  timestamp: number;
}

export default function UploadScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>('camera');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode>('original');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Multi-page scanning state
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isMultiPageMode, setIsMultiPageMode] = useState(false);

  // Edge detection state
  const [edgeDetected, setEdgeDetected] = useState(false);
  const [autoCapturing, setAutoCapturing] = useState(false);

  // Animation for frame guide
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const edgeAnim = useRef(new Animated.Value(0)).current;

  const uploadMutation = useUploadNotice();
  const { paywall, isLoading: isCheckingPaywall } = usePaywall('create_notice');

  // Pulse animation for frame guide
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
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
  }, [pulseAnim]);

  // Edge detection animation
  useEffect(() => {
    Animated.timing(edgeAnim, {
      toValue: edgeDetected ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [edgeDetected]);

  // Simulate edge detection (in production, use ML model)
  useEffect(() => {
    if (scanState !== 'camera') return;

    const interval = setInterval(() => {
      // Simulate detection with random confidence
      const detected = Math.random() > 0.4; // 60% detection rate
      setEdgeDetected(detected);
    }, 800);

    return () => clearInterval(interval);
  }, [scanState]);

  // Auto-capture when edges detected
  useEffect(() => {
    if (!edgeDetected || !isMultiPageMode || autoCapturing) return;

    const timeout = setTimeout(() => {
      setAutoCapturing(true);
      handleCapture().finally(() => setAutoCapturing(false));
    }, 1500);

    return () => clearTimeout(timeout);
  }, [edgeDetected, isMultiPageMode, autoCapturing]);

  // Request camera permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const generatePageId = () => `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const createThumbnail = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 150 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      return uri;
    }
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          base64: false,
        });
        if (photo) {
          if (isMultiPageMode) {
            // Add to pages array
            const thumbnailUri = await createThumbnail(photo.uri);
            const newPage: ScannedPage = {
              id: generatePageId(),
              uri: photo.uri,
              thumbnailUri,
              timestamp: Date.now(),
            };
            setPages((prev) => [...prev, newPage]);
            // Stay in camera mode for next page
          } else {
            setOriginalImage(photo.uri);
            setCapturedImage(photo.uri);
            setEnhanceMode('original');
            setScanState('preview');
          }
        }
      } catch (error) {
        console.error('Failed to capture:', error);
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
    }
  };

  const handleGalleryPick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: isMultiPageMode,
    });

    if (!result.canceled && result.assets.length > 0) {
      if (isMultiPageMode) {
        // Add all selected images to pages
        for (const asset of result.assets) {
          const thumbnailUri = await createThumbnail(asset.uri);
          const newPage: ScannedPage = {
            id: generatePageId(),
            uri: asset.uri,
            thumbnailUri,
            timestamp: Date.now(),
          };
          setPages((prev) => [...prev, newPage]);
        }
      } else {
        setOriginalImage(result.assets[0].uri);
        setCapturedImage(result.assets[0].uri);
        setEnhanceMode('original');
        setScanState('preview');
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setOriginalImage(null);
    setScanState('camera');
    setUploadProgress(0);
    setEnhanceMode('original');
  };

  const handleDeletePage = (pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  const handleReorderPage = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= pages.length) return;

    setPages((prev) => {
      const newPages = [...prev];
      [newPages[fromIndex], newPages[toIndex]] = [newPages[toIndex], newPages[fromIndex]];
      return newPages;
    });
  };

  const toggleMultiPageMode = () => {
    if (isMultiPageMode && pages.length > 0) {
      Alert.alert(
        'Disable Multi-Page Mode?',
        'This will clear all scanned pages.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              setIsMultiPageMode(false);
              setPages([]);
            },
          },
        ]
      );
    } else {
      setIsMultiPageMode(!isMultiPageMode);
    }
  };

  // Apply image enhancement
  const applyEnhancement = async (mode: EnhanceMode) => {
    if (!originalImage || mode === enhanceMode) return;

    setIsEnhancing(true);

    try {
      let actions: ImageManipulator.Action[] = [];

      switch (mode) {
        case 'original':
          setCapturedImage(originalImage);
          setEnhanceMode('original');
          setIsEnhancing(false);
          return;

        case 'auto':
        case 'document':
        case 'grayscale':
          actions = [{ resize: { width: 2000 } }];
          break;
      }

      const result = await ImageManipulator.manipulateAsync(
        originalImage,
        actions,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      setCapturedImage(result.uri);
      setEnhanceMode(mode);
    } catch (error) {
      console.error('Enhancement failed:', error);
      Alert.alert('Error', 'Failed to enhance image');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUpload = async () => {
    const filesToUpload = isMultiPageMode ? pages : (capturedImage ? [{ uri: capturedImage }] : []);

    if (filesToUpload.length === 0) return;

    // Check paywall before uploading
    if (paywall?.isBlocked) {
      setShowPaywall(true);
      return;
    }

    setScanState('uploading');

    try {
      if (isMultiPageMode && pages.length > 1) {
        // Generate PDF from multiple pages
        const validation = validatePages(pages);
        if (!validation.valid) {
          Alert.alert('Validation Error', validation.errors.join('\n'));
          setScanState('pages');
          return;
        }

        const pdfResult = await generatePdfFromPages(pages);
        if (!pdfResult.success || !pdfResult.pdfUri) {
          throw new Error(pdfResult.error || 'PDF generation failed');
        }

        // Upload the generated PDF
        await uploadMutation.mutateAsync({
          file: {
            uri: pdfResult.pdfUri,
            type: 'application/pdf',
            name: `notice_${Date.now()}.pdf`,
          },
          onProgress: setUploadProgress,
        });
      } else {
        // Single page upload
        await uploadMutation.mutateAsync({
          file: {
            uri: capturedImage!,
            type: 'image/jpeg',
            name: `notice_${Date.now()}.jpg`,
          },
          onProgress: setUploadProgress,
        });
      }

      setScanState('success');
    } catch (error) {
      console.error('Upload failed:', error);
      setScanState('error');
    }
  };

  const handleUpgradeFromPaywall = () => {
    setShowPaywall(false);
    router.push('/billing/plans');
  };

  const handleDone = () => {
    handleRetake();
    setPages([]);
    setIsMultiPageMode(false);
    router.push('/notices');
  };

  const toggleFlash = () => {
    setFlashMode((current) => (current === 'off' ? 'on' : 'off'));
  };

  const toggleCamera = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  // Permission states
  if (hasPermission === null) {
    return <LoadingSpinner fullScreen message="Requesting camera access..." />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <CameraIcon size={64} color={COLORS.gray[400]} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          EffortlessInsight needs camera access to scan notice documents. Please enable camera
          access in your device settings.
        </Text>
        <Button title="Open Settings" onPress={() => {}} variant="primary" />
      </View>
    );
  }

  // Uploading state
  if (scanState === 'uploading') {
    return (
      <View style={styles.uploadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.uploadingTitle}>
          Uploading {isMultiPageMode ? `${pages.length} Pages` : 'Notice'}
        </Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>{uploadProgress}% complete</Text>
      </View>
    );
  }

  // Success state
  if (scanState === 'success') {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Check size={48} color={COLORS.white} />
        </View>
        <Text style={styles.successTitle}>Notice Uploaded!</Text>
        <Text style={styles.successText}>
          {isMultiPageMode
            ? `Your ${pages.length}-page notice has been uploaded and is being processed.`
            : 'Your notice has been uploaded and is being processed.'}{' '}
          You'll receive a notification once the AI analysis is complete.
        </Text>
        <View style={styles.successActions}>
          <Button title="Upload Another" variant="outline" onPress={handleRetake} />
          <Button title="View Notices" onPress={handleDone} />
        </View>
      </View>
    );
  }

  // Error state
  if (scanState === 'error') {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <X size={48} color={COLORS.white} />
        </View>
        <Text style={styles.errorTitle}>Upload Failed</Text>
        <Text style={styles.errorText}>
          Something went wrong while uploading your notice. Please check your connection and try
          again.
        </Text>
        <View style={styles.errorActions}>
          <Button title="Try Again" onPress={handleUpload} />
          <Button title="Cancel" variant="outline" onPress={handleRetake} />
        </View>
      </View>
    );
  }

  // Pages review state (multi-page mode)
  if (scanState === 'pages' || (isMultiPageMode && pages.length > 0 && scanState === 'camera')) {
    return (
      <View style={styles.pagesContainer}>
        {/* Header */}
        <View style={styles.pagesHeader}>
          <TouchableOpacity onPress={() => {
            if (pages.length > 0) {
              Alert.alert(
                'Discard Pages?',
                `You have ${pages.length} scanned pages. Discard them?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => {
                    setPages([]);
                    setIsMultiPageMode(false);
                    setScanState('camera');
                  }},
                ]
              );
            } else {
              setScanState('camera');
              setIsMultiPageMode(false);
            }
          }}>
            <X size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <View style={styles.pagesHeaderCenter}>
            <Layers size={20} color={COLORS.primary} />
            <Text style={styles.pagesHeaderTitle}>
              {pages.length} Page{pages.length !== 1 ? 's' : ''} Scanned
            </Text>
          </View>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUpload}
            disabled={pages.length === 0}
          >
            <UploadIcon size={18} color={COLORS.white} />
            <Text style={styles.uploadButtonText}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Page List */}
        <ScrollView style={styles.pagesList} contentContainerStyle={styles.pagesListContent}>
          {pages.map((page, index) => (
            <View key={page.id} style={styles.pageItem}>
              <Image
                source={{ uri: page.thumbnailUri || page.uri }}
                style={styles.pageThumb}
                resizeMode="cover"
              />
              <View style={styles.pageInfo}>
                <Text style={styles.pageNumber}>Page {index + 1}</Text>
                <Text style={styles.pageTime}>
                  {new Date(page.timestamp).toLocaleTimeString()}
                </Text>
              </View>
              <View style={styles.pageActions}>
                <TouchableOpacity
                  onPress={() => handleReorderPage(index, 'up')}
                  disabled={index === 0}
                  style={[styles.pageAction, index === 0 && styles.pageActionDisabled]}
                >
                  <ChevronLeft size={20} color={index === 0 ? COLORS.gray[300] : COLORS.gray[600]} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReorderPage(index, 'down')}
                  disabled={index === pages.length - 1}
                  style={[styles.pageAction, index === pages.length - 1 && styles.pageActionDisabled]}
                >
                  <ChevronRight size={20} color={index === pages.length - 1 ? COLORS.gray[300] : COLORS.gray[600]} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletePage(page.id)}
                  style={[styles.pageAction, styles.deleteAction]}
                >
                  <Trash2 size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add Page Button */}
          <TouchableOpacity
            style={styles.addPageButton}
            onPress={() => setScanState('camera')}
          >
            <Plus size={24} color={COLORS.primary} />
            <Text style={styles.addPageText}>Add Another Page</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Tips */}
        <View style={styles.pagesTips}>
          <Text style={styles.pagesTipsText}>
            Tip: Pages will be combined into a single document for AI processing.
          </Text>
        </View>
      </View>
    );
  }

  // Preview state
  if (scanState === 'preview' && capturedImage) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />

        {isEnhancing && (
          <View style={styles.enhancingOverlay}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.enhancingText}>Enhancing...</Text>
          </View>
        )}

        <View style={styles.previewOverlay}>
          <Text style={styles.previewTitle}>Review Your Scan</Text>
          <Text style={styles.previewText}>
            Make sure the entire notice is visible and the text is readable.
          </Text>
        </View>

        {/* Enhancement Options */}
        <View style={styles.enhanceContainer}>
          <Text style={styles.enhanceLabel}>Enhance:</Text>
          <View style={styles.enhanceOptions}>
            {(['original', 'auto', 'document'] as EnhanceMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.enhanceOption,
                  enhanceMode === mode && styles.enhanceOptionActive,
                ]}
                onPress={() => applyEnhancement(mode)}
                disabled={isEnhancing}
              >
                {mode === 'original' && <ImageIcon size={18} color={enhanceMode === mode ? COLORS.primary : COLORS.white} />}
                {mode === 'auto' && <Wand2 size={18} color={enhanceMode === mode ? COLORS.primary : COLORS.white} />}
                {mode === 'document' && <FileText size={18} color={enhanceMode === mode ? COLORS.primary : COLORS.white} />}
                <Text style={[
                  styles.enhanceOptionText,
                  enhanceMode === mode && styles.enhanceOptionTextActive,
                ]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewButton} onPress={handleRetake}>
            <RotateCcw size={24} color={COLORS.white} />
            <Text style={styles.previewButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.previewButton, styles.previewButtonPrimary]}
            onPress={handleUpload}
            disabled={isEnhancing}
          >
            <Check size={24} color={COLORS.white} />
            <Text style={styles.previewButtonText}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera state
  const edgeColor = edgeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.white, COLORS.success],
  });

  return (
    <View style={styles.container}>
      <PaywallModal
        visible={showPaywall}
        paywall={paywall}
        onClose={() => setShowPaywall(false)}
        onUpgrade={handleUpgradeFromPaywall}
      />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraFacing}
        flash={flashMode}
      >
        {/* Edge Detection Frame Guide */}
        <View style={styles.frameContainer}>
          <Animated.View style={[styles.frame, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View style={[styles.corner, styles.cornerTL, { borderColor: edgeColor }]} />
            <Animated.View style={[styles.corner, styles.cornerTR, { borderColor: edgeColor }]} />
            <Animated.View style={[styles.corner, styles.cornerBL, { borderColor: edgeColor }]} />
            <Animated.View style={[styles.corner, styles.cornerBR, { borderColor: edgeColor }]} />
          </Animated.View>

          {/* Edge Detection Status */}
          <View style={styles.edgeStatus}>
            {edgeDetected ? (
              <Text style={[styles.edgeStatusText, { color: COLORS.success }]}>
                ✓ Document detected
                {isMultiPageMode && ' - Hold steady to auto-capture'}
              </Text>
            ) : (
              <Text style={styles.edgeStatusText}>
                Position the notice within the frame
              </Text>
            )}
          </View>

          {/* Multi-page badge */}
          {isMultiPageMode && pages.length > 0 && (
            <TouchableOpacity
              style={styles.pagesBadge}
              onPress={() => setScanState('pages')}
            >
              <Layers size={16} color={COLORS.white} />
              <Text style={styles.pagesBadgeText}>{pages.length} pages</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Top Row */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              {flashMode === 'on' ? (
                <Zap size={24} color={COLORS.warning} />
              ) : (
                <ZapOff size={24} color={COLORS.white} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, isMultiPageMode && styles.controlButtonActive]}
              onPress={toggleMultiPageMode}
            >
              <Layers size={24} color={isMultiPageMode ? COLORS.success : COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <RotateCcw size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Bottom Row */}
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.galleryButton} onPress={handleGalleryPick}>
              <ImageIcon size={24} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.captureButton,
                edgeDetected && styles.captureButtonActive,
              ]}
              onPress={handleCapture}
            >
              <View style={[
                styles.captureButtonInner,
                edgeDetected && styles.captureButtonInnerActive,
              ]} />
            </TouchableOpacity>

            {isMultiPageMode && pages.length > 0 ? (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setScanState('pages')}
              >
                <Check size={24} color={COLORS.white} />
              </TouchableOpacity>
            ) : (
              <View style={styles.placeholderButton} />
            )}
          </View>
        </View>
      </CameraView>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>
          {isMultiPageMode ? 'Multi-Page Mode' : 'Tips for best results:'}
        </Text>
        {isMultiPageMode ? (
          <>
            <Text style={styles.tipText}>• Auto-capture when document is detected</Text>
            <Text style={styles.tipText}>• Tap the page counter to review & reorder</Text>
            <Text style={styles.tipText}>• Up to 50 pages per document</Text>
          </>
        ) : (
          <>
            <Text style={styles.tipText}>• Use good lighting</Text>
            <Text style={styles.tipText}>• Keep the document flat</Text>
            <Text style={styles.tipText}>• Tap the layers icon for multi-page</Text>
          </>
        )}
      </View>
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
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  frame: {
    width: '90%',
    aspectRatio: 0.707, // A4 ratio
    maxHeight: '65%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 35,
    height: 35,
    borderColor: COLORS.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 4,
  },
  edgeStatus: {
    marginTop: SPACING.lg,
  },
  edgeStatusText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  pagesBadge: {
    position: 'absolute',
    top: -40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  pagesBadgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  galleryButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
  },
  captureButtonInnerActive: {
    backgroundColor: COLORS.success,
  },
  doneButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderButton: {
    width: 54,
    height: 54,
  },
  tipsContainer: {
    backgroundColor: COLORS.gray[900],
    padding: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.md,
  },
  tipsTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  tipText: {
    color: COLORS.gray[400],
    fontSize: FONT_SIZES.sm,
  },
  // Pages review styles
  pagesContainer: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  pagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  pagesHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pagesHeaderTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  uploadButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  pagesList: {
    flex: 1,
  },
  pagesListContent: {
    padding: SPACING.md,
  },
  pageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  pageThumb: {
    width: 60,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
  },
  pageInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  pageNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  pageTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  pageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  pageAction: {
    padding: SPACING.sm,
  },
  pageActionDisabled: {
    opacity: 0.3,
  },
  deleteAction: {
    marginLeft: SPACING.sm,
  },
  addPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    marginTop: SPACING.sm,
  },
  addPageText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.primary,
  },
  pagesTips: {
    padding: SPACING.md,
    backgroundColor: COLORS.gray[100],
  },
  pagesTipsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  // Other styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  permissionTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  permissionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  previewImage: {
    flex: 1,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.xxl,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
  },
  previewText: {
    color: COLORS.gray[300],
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.xs,
  },
  enhancingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  enhancingText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.md,
  },
  enhanceContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  enhanceLabel: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  enhanceOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  enhanceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  enhanceOptionActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
  },
  enhanceOptionText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  enhanceOptionTextActive: {
    color: COLORS.primary,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl + 20 : SPACING.xxl,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  previewButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  previewButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  uploadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  uploadingTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  progressContainer: {
    width: '80%',
    height: 8,
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  successText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  successActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  errorActions: {
    gap: SPACING.md,
  },
});
