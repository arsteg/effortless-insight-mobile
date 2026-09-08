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
  BackHandler,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, Camera, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  Zap,
  ZapOff,
  RotateCcw,
  Check,
  CloudOff,
  X,
  Wand2,
  FileText,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FolderOpen,
  Layers,
  Upload as UploadIcon,
  Crop as CropIcon,
} from 'lucide-react-native';
import { useUploadNotice } from '../../src/hooks/useNotices';
import { usePaywall } from '../../src/hooks/useBilling';
import { LoadingSpinner, Button } from '../../src/components/common';
import { PaywallModal } from '../../src/components/billing';
import { CropEditor } from '../../src/components/scanner';
import { shouldShowPagesReview, shouldShowPagesBadge, reorderPage } from '../../src/utils/scannerFlow';
import { validateImportedFile } from '../../src/utils/fileImport';
import { getApiErrorMessage } from '../../src/services/api';
import { useUIStore } from '../../src/stores';
import { queueUpload } from '../../src/services/pendingUploads';
import { QUEUED_OFFLINE_MESSAGE } from '../../src/utils/pendingUploadPolicy';
import {
  generatePdfFromPages,
  validatePages,
  deleteScratchFile,
  UPLOAD_IMAGE_WIDTH,
} from '../../src/utils/pdfGenerator';
import {
  isStorageLow,
  hasRoomForScan,
  estimatedScanBytes,
  formatBytes,
  lowStorageWarning,
  isOutOfSpaceError,
  OUT_OF_SPACE_MESSAGE,
  STORAGE_HEADROOM_BYTES,
} from '../../src/utils/storageSpace';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

import type { ScanState } from '../../src/utils/scannerFlow';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';
type EnhanceMode = 'original' | 'auto' | 'document' | 'grayscale';

interface ScannedPage {
  id: string;
  uri: string;
  thumbnailUri?: string;
  timestamp: number;
}

export default function UploadScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>('camera');
  const [uploadProgress, setUploadProgress] = useState(0);
  /**
   * Blocks a second shutter press while one capture is in flight. A ref, not
   * state: two rapid taps land in the same render, so a state flag would still
   * read stale and fire `takePictureAsync` twice (TC-MOB-082).
   */
  const isCapturingRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);
  /**
   * Pages embedded so far while assembling the PDF. Without this the screen
   * showed "Uploading 0%" frozen for the whole assembly, which reads as a hang.
   */
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  /**
   * Whether this tab is the one on screen.
   *
   * Tabs stay mounted when you switch away, so `CameraView` kept the camera
   * session open — and the frame-guide animation kept running — for the whole
   * session. That held camera buffers permanently (TC-MOB-084), drew power
   * continuously, and left the OS camera indicator lit while the user was
   * reading notices (TC-MOB-085).
   */
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Distinguishes "queued for later" from "uploaded" on the success screen.
  const [queuedOffline, setQueuedOffline] = useState(false);
  const isOnline = useUIStore((state) => state.isOnline);
  /**
   * What "Try Again" should re-run. A descriptor rather than a stored closure:
   * a captured function would pin that render's `pages`/`capturedImage`, and
   * the descriptor is what actually distinguishes the two upload paths.
   * Previously Try Again always called the capture path, so a failed PDF
   * import retried against a null image and lost the file.
   */
  type RetryTarget =
    | { kind: 'capture' }
    | { kind: 'import'; uri: string; name: string; contentType: string };
  const retryTargetRef = useRef<RetryTarget | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode>('original');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Multi-page scanning state
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isMultiPageMode, setIsMultiPageMode] = useState(false);

  // Animation for frame guide
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const uploadMutation = useUploadNotice();
  const { paywall, isLoading: isCheckingPaywall } = usePaywall('create_notice');

  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );

  /**
   * Warn before scanning when the device is nearly full (TC-MOB-087).
   *
   * A warning, not a block: the estimate is rough, and a user who knows their
   * own phone should not be stopped from trying. Shown once per app run, so it
   * does not nag on every visit to the tab.
   */
  const lowStorageWarnedRef = useRef(false);
  useEffect(() => {
    if (!isScreenFocused || lowStorageWarnedRef.current) return;

    void (async () => {
      try {
        const free = await FileSystem.getFreeDiskStorageAsync();
        if (isStorageLow(free)) {
          lowStorageWarnedRef.current = true;
          Alert.alert('Storage is nearly full', lowStorageWarning(free), [
            { text: 'Manage Storage', onPress: () => router.push('/(tabs)/profile') },
            { text: 'Continue', style: 'cancel' },
          ]);
        }
      } catch {
        // Unreadable free space is not a reason to interrupt the user.
      }
    })();
  }, [isScreenFocused, router]);

  /** The camera is only worth holding open when it is actually being used. */
  const isCameraActive = isScreenFocused && scanState === 'camera';

  // Pulse animation for the frame guide, and only while the guide is on screen.
  useEffect(() => {
    if (!isCameraActive) return;

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
  }, [pulseAnim, isCameraActive]);

  // NOTE: real document edge-detection / auto-capture needs an on-device CV/ML
  // model, which isn't available here — `expo-camera` exposes no per-frame API.
  // An earlier implementation faked it with Math.random(), which could
  // auto-capture blank/blurry frames (audit B2). Capture is manual via the
  // shutter button, and the frame below is a STATIC aiming guide: it must not
  // pretend to track a document, or users read a missing feature as a broken
  // one. Restore the detected/auto-capture states with a real detector
  // (TC-MOB-020) — the UI for them is in git history.

  // Request camera permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  /**
   * Every intermediate file this scan has written: captures, thumbnails,
   * enhanced copies, the normalised JPEG and the generated PDF. Cleared to
   * disk-free on discard and after a successful upload, so a scan does not
   * leave its working set behind (TC-MOB-082).
   */
  const scratchFilesRef = useRef<Set<string>>(new Set());

  const trackScratchFile = (uri?: string | null) => {
    if (uri) scratchFilesRef.current.add(uri);
    return uri;
  };

  /** Deletes every tracked intermediate. Safe to call more than once. */
  const purgeScratchFiles = async () => {
    const files = Array.from(scratchFilesRef.current);
    scratchFilesRef.current.clear();
    await Promise.all(files.map((uri) => deleteScratchFile(uri)));
  };

  /**
   * Whether a just-failed write failed because the disk is full.
   *
   * `copyAsync` rejects without a usable code, so the cause is inferred from
   * free space after the fact rather than from the error itself.
   */
  const isDeviceOutOfSpace = async (): Promise<boolean> => {
    try {
      return (await FileSystem.getFreeDiskStorageAsync()) < STORAGE_HEADROOM_BYTES;
    } catch {
      return false;
    }
  };

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
    if (!cameraRef.current) return;
    // Two rapid taps otherwise start two concurrent captures, which duplicates
    // the page on iOS and throws on Android (TC-MOB-082).
    if (isCapturingRef.current) return;

    isCapturingRef.current = true;
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      if (photo) {
        trackScratchFile(photo.uri);

        if (isMultiPageMode) {
          const pageId = generatePageId();
          // Added immediately with no thumbnail. Awaiting one here decoded and
          // re-encoded a 12MP JPEG before the shutter freed up, costing up to
          // a second per page; the list falls back to `uri` until it lands.
          setPages((prev) => [...prev, { id: pageId, uri: photo.uri, timestamp: Date.now() }]);

          void createThumbnail(photo.uri).then((thumbnailUri) => {
            if (thumbnailUri === photo.uri) return; // generation failed
            trackScratchFile(thumbnailUri);
            setPages((prev) =>
              prev.map((page) => (page.id === pageId ? { ...page, thumbnailUri } : page))
            );
          });
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
      Alert.alert(t('upload.error'), t('upload.failedToCaptureImagePleaseTryAgain'));
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
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
          const pageId = generatePageId();
          setPages((prev) => [...prev, { id: pageId, uri: asset.uri, timestamp: Date.now() }]);

          void createThumbnail(asset.uri).then((thumbnailUri) => {
            if (thumbnailUri === asset.uri) return;
            trackScratchFile(thumbnailUri);
            setPages((prev) =>
              prev.map((page) => (page.id === pageId ? { ...page, thumbnailUri } : page))
            );
          });
        }
      } else {
        setOriginalImage(result.assets[0].uri);
        setCapturedImage(result.assets[0].uri);
        setEnhanceMode('original');
        setScanState('preview');
      }
    }
  };

  /**
   * Upload a file straight from the file system. A PDF is already a document,
   * so it skips capture preview, enhancement and crop — all of which assume an
   * image — and goes directly to the upload state.
   */
  const uploadImportedFile = async (uri: string, name: string, contentType: string) => {
    // Same quota gate as the capture path, or importing would bypass the paywall.
    if (paywall?.isBlocked) {
      setShowPaywall(true);
      return;
    }

    // Retrying must re-send THIS file, not fall back to the capture path.
    retryTargetRef.current = { kind: 'import', uri, name, contentType };

    setScanState('uploading');
    setUploadProgress(0);
    setUploadError(null);
    try {
      await uploadMutation.mutateAsync({
        file: { uri, type: contentType, name },
        onProgress: setUploadProgress,
      });
      setScanState('success');
    } catch (error) {
      console.error('Import upload failed:', error);
      setUploadError(getApiErrorMessage(error));
      setScanState('error');
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // The API accepts PDFs and these image types; offering the same set
        // means a notice saved in Files (not the photo library) still works.
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'],
        // Without this the picker returns a URI the upload layer cannot read.
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const validation = validateImportedFile({
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      });

      if (!validation.ok) {
        Alert.alert('Cannot use this file', validation.error);
        return;
      }

      if (validation.isPdf) {
        await uploadImportedFile(file.uri, file.name, validation.contentType);
        return;
      }

      // An image from Files behaves like a gallery pick: review it first.
      setOriginalImage(file.uri);
      setCapturedImage(file.uri);
      setEnhanceMode('original');
      setScanState('preview');
    } catch (error) {
      console.error('File import failed:', error);
      Alert.alert(t('upload.error'), t('upload.couldNotOpenThatFilePleaseTryAgain'));
    }
  };

  /**
   * Offers both sources rather than crowding the camera with buttons. The
   * title deliberately avoids the word "Import" — "Import Notice" reads as
   * "Important Notice" at a glance, which is badly confusing in an app about
   * tax notices. Each button names the destination it opens.
   */
  const handleImport = () => {
    Alert.alert(t('upload.chooseAFile'),
      'Pick a photo of your notice, or a PDF saved on this device.',
      [
        { text: 'Photos', onPress: handleGalleryPick },
        { text: 'Browse Files', onPress: handleFilePick },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  /** Anything the user would lose by leaving the scanner now. */
  const hasUnsavedScan = pages.length > 0 || capturedImage !== null;

  /** Clears every scan-related piece of state. */
  const clearScan = () => {
    void purgeScratchFiles();
    setPages([]);
    setIsMultiPageMode(false);
    setCapturedImage(null);
    setOriginalImage(null);
    setEnhanceMode('original');
    setUploadError(null);
    setUploadProgress(0);
    retryTargetRef.current = null;
    setScanState('camera');
  };

  /**
   * Runs `onDiscard`, asking first only when there is something to lose.
   * Shared by the camera's close button, the review screen's close button and
   * Android's hardware back, so all three behave identically (TC-MOB-032).
   */
  const confirmDiscard = (onDiscard: () => void) => {
    if (!hasUnsavedScan) {
      onDiscard();
      return;
    }

    const what = pages.length > 0
      ? `You have ${pages.length} scanned page${pages.length === 1 ? '' : 's'}.`
      : 'You have an unsaved scan.';

    Alert.alert('Discard scan?', `${what} This cannot be undone.`, [
      { text: 'Keep Scanning', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  };

  /** Leaves the scanner entirely, discarding whatever was captured. */
  const exitScanner = () => {
    clearScan();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // Android hardware back must go through the same confirmation as the close
  // button. Scoped to focus because this is a tab screen that stays mounted:
  // a plain useEffect would swallow back presses from every other tab.
  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!hasUnsavedScan) return false; // nothing to lose — let the OS handle it
        confirmDiscard(exitScanner);
        return true;
      });
      return () => subscription.remove();
    }, [hasUnsavedScan, pages.length])
  );

  const handleRetake = () => {
    // A discard, not a retry: Try Again goes through handleRetryUpload and
    // still needs these files.
    void purgeScratchFiles();
    setCapturedImage(null);
    setOriginalImage(null);
    setScanState('camera');
    setUploadProgress(0);
    setEnhanceMode('original');
    setUploadError(null);
    retryTargetRef.current = null;
  };

  const handleDeletePage = (pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  const handleReorderPage = (fromIndex: number, direction: 'up' | 'down') => {
    setPages((prev) => reorderPage(prev, fromIndex, direction));
  };

  const toggleMultiPageMode = () => {
    if (isMultiPageMode && pages.length > 0) {
      Alert.alert(t('upload.disableMultiPageMode'),
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

      trackScratchFile(result.uri);
      setCapturedImage(result.uri);
      setEnhanceMode(mode);
    } catch (error) {
      console.error('Enhancement failed:', error);
      Alert.alert(t('upload.error'), t('upload.failedToEnhanceImage'));
    } finally {
      setIsEnhancing(false);
    }
  };

  /**
   * Save a scan for later instead of uploading it now.
   *
   * Offline, the upload call used to fail like any server error and the
   * capture was lost — the camera's temp file is reclaimed by the OS, so there
   * was nothing to retry from (TC-MOB-058).
   */
  const queueForLater = async (file: { uri: string; type: string; name: string }): Promise<boolean> => {
    const queued = await queueUpload({
      uri: file.uri,
      fileName: file.name,
      contentType: file.type,
    });

    if (!queued) {
      // Do not claim the scan was saved when the copy failed.
      setUploadError(
        (await isDeviceOutOfSpace())
          ? OUT_OF_SPACE_MESSAGE
          : 'Could not save this scan to your device. Please try again.'
      );
      setScanState('error');
      return false;
    }

    setQueuedOffline(true);
    setScanState('success');
    return true;
  };

  const handleUpload = async () => {
    const filesToUpload = isMultiPageMode ? pages : (capturedImage ? [{ uri: capturedImage }] : []);

    if (filesToUpload.length === 0) return;

    // Check paywall before uploading
    if (paywall?.isBlocked) {
      setShowPaywall(true);
      return;
    }

    // The capture path becomes the retry target, replacing any earlier import.
    retryTargetRef.current = { kind: 'capture' };

    setScanState('uploading');
    setUploadError(null);
    setQueuedOffline(false);

    try {
      // Checked before assembly, not after a failure: a ten-page PDF is built
      // entirely in memory and then written, so discovering there is no room
      // at the write costs the user the whole wait (TC-MOB-087).
      const freeBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
      if (!hasRoomForScan(freeBytes, filesToUpload.length)) {
        setUploadError(
          `This scan needs about ${formatBytes(estimatedScanBytes(filesToUpload.length))} of free space and your device has ${formatBytes(freeBytes ?? 0)}. Free up space — you can clear cached documents in Profile → Storage — then try again.`
        );
        setScanState('error');
        return;
      }

      // In multi-page mode captured images live in `pages` and `capturedImage`
      // stays null, so even a single page must go through the PDF path — the
      // else-branch would dereference a null capturedImage.
      if (isMultiPageMode && pages.length >= 1) {
        // Generate PDF from multiple pages
        const validation = validatePages(pages);
        if (!validation.valid) {
          Alert.alert('Validation Error', validation.errors.join('\n'));
          setScanState('pages');
          return;
        }

        setPdfProgress({ done: 0, total: pages.length });
        const pdfResult = await generatePdfFromPages(pages, {
          onProgress: (done, total) => setPdfProgress({ done, total }),
        });
        setPdfProgress(null);
        if (!pdfResult.success || !pdfResult.pdfUri) {
          throw new Error(pdfResult.error || 'PDF generation failed');
        }

        const pdfFile = {
          uri: pdfResult.pdfUri,
          type: 'application/pdf',
          name: `notice_${Date.now()}.pdf`,
        };
        trackScratchFile(pdfResult.pdfUri);

        if (!isOnline) {
          // Queued, not sent: pendingUploads has copied the file to its own
          // store, so the scratch PDF is no longer needed.
          if (await queueForLater(pdfFile)) void purgeScratchFiles();
          return;
        }

        // Upload the generated PDF
        await uploadMutation.mutateAsync({
          file: pdfFile,
          onProgress: setUploadProgress,
        });
      } else {
        // Single page: normalize to JPEG so the declared content type is
        // always accurate, even for a PNG picked from the gallery (audit B-mime).
        //
        // Resized to the same 1700px the multi-page path uses (~200 DPI for
        // A4). This branch previously passed no actions at all, so the most
        // common upload in the app sent a full 12MP capture — several MB on
        // cellular — while a ten-page scan sent resized pages (TC-MOB-086).
        const normalized = await ImageManipulator.manipulateAsync(
          capturedImage!,
          [{ resize: { width: UPLOAD_IMAGE_WIDTH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        const imageFile = {
          uri: normalized.uri,
          type: 'image/jpeg',
          name: `notice_${Date.now()}.jpg`,
        };
        trackScratchFile(normalized.uri);

        if (!isOnline) {
          if (await queueForLater(imageFile)) void purgeScratchFiles();
          return;
        }

        await uploadMutation.mutateAsync({
          file: imageFile,
          onProgress: setUploadProgress,
        });
      }

      // The server has the file; every local intermediate is now dead weight.
      void purgeScratchFiles();
      setScanState('success');
    } catch (error) {
      console.error('Upload failed:', error);
      setPdfProgress(null);
      // Surface the real reason. A dropped connection, an oversized file and an
      // expired session all used to read as the same generic sentence — and a
      // full disk read as "PDF generation failed", which the user cannot act
      // on (TC-MOB-087).
      setUploadError(
        isOutOfSpaceError(error) ? OUT_OF_SPACE_MESSAGE : getApiErrorMessage(error)
      );
      setScanState('error');
    }
  };

  /** Re-runs whichever upload failed — a capture, or an imported file. */
  const handleRetryUpload = () => {
    const target = retryTargetRef.current;
    if (target?.kind === 'import') {
      uploadImportedFile(target.uri, target.name, target.contentType);
      return;
    }
    handleUpload();
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
    return <LoadingSpinner fullScreen message={t('upload.requestingCameraAccess')} />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <CameraIcon size={64} color={COLORS.gray[400]} />
        <Text style={styles.permissionTitle}>{t('upload.cameraAccessRequired')}</Text>
        <Text style={styles.permissionText}>
          EffortlessInsight needs camera access to scan notice documents. Please enable camera
          access in your device settings.
        </Text>
        <Button title={t('upload.openSettings')} onPress={() => Linking.openSettings()} variant="primary" />
      </View>
    );
  }

  // Uploading state
  if (scanState === 'uploading') {
    return (
      <View style={styles.uploadingContainer}>
        <LoadingSpinner size="large" />
        {/* Assembly runs before a single byte is sent. Labelling it "Uploading
            0%" left the bar frozen for the whole PDF build, which reads as a
            hang (TC-MOB-082). */}
        <Text style={styles.uploadingTitle}>
          {pdfProgress
            ? t('upload.preparingPages')
            : `Uploading ${isMultiPageMode ? `${pages.length} Pages` : 'Notice'}`}
        </Text>
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: pdfProgress
                  ? `${Math.round((pdfProgress.done / Math.max(pdfProgress.total, 1)) * 100)}%`
                  : `${uploadProgress}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {pdfProgress
            ? `Page ${pdfProgress.done} of ${pdfProgress.total}`
            : `${uploadProgress}% complete`}
        </Text>
      </View>
    );
  }

  // Success state
  if (scanState === 'success') {
    return (
      <View style={styles.successContainer}>
        {/* A queued scan is saved, not uploaded. Saying "Uploaded!" when the
            file is still sitting on the device would be a lie the user acts
            on (TC-MOB-058). */}
        <View style={[styles.successIcon, queuedOffline && styles.pendingIcon]}>
          {queuedOffline ? (
            <CloudOff size={48} color={COLORS.white} />
          ) : (
            <Check size={48} color={COLORS.white} />
          )}
        </View>
        <Text style={styles.successTitle}>
          {queuedOffline ? 'Pending upload' : 'Notice Uploaded!'}
        </Text>
        <Text style={styles.successText}>
          {queuedOffline
            ? QUEUED_OFFLINE_MESSAGE
            : `${
                isMultiPageMode
                  ? `Your ${pages.length}-page notice has been uploaded and is being processed.`
                  : 'Your notice has been uploaded and is being processed.'
              } You'll receive a notification once the AI analysis is complete.`}
        </Text>
        <View style={styles.successActions}>
          <Button title={t('upload.uploadAnother')} variant="outline" onPress={handleRetake} />
          <Button title={t('upload.viewNotices')} onPress={handleDone} />
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
        <Text style={styles.errorTitle}>{t('upload.uploadFailed')}</Text>
        <Text style={styles.errorText}>
          {uploadError ?? 'Something went wrong while uploading your notice.'}
        </Text>
        <Text style={styles.errorHint}>{t('upload.yourScanIsSavedYouCanTryAgain')}</Text>
        <View style={styles.errorActions}>
          <Button title={t('upload.tryAgain')} onPress={handleRetryUpload} />
          <Button title={t('upload.cancel')} variant="outline" onPress={handleRetake} />
        </View>
      </View>
    );
  }

  // Pages review state (multi-page mode). Gated on the explicit 'pages' state
  // only: the previous condition also matched 'camera' whenever a page existed,
  // which made the camera unreachable after the first capture and left
  // "Add Another Page" looking dead (TC-MOB-023).
  if (shouldShowPagesReview(scanState)) {
    return (
      <View style={styles.pagesContainer}>
        {/* Header */}
        <View style={styles.pagesHeader}>
          <TouchableOpacity
            onPress={() => confirmDiscard(clearScan)}
            accessibilityRole="button"
            accessibilityLabel="Discard scanned pages"
          >
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
            <Text style={styles.uploadButtonText}>{t('upload.upload')}</Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Move page ${index + 1} earlier`}
                >
                  <ChevronUp size={20} color={index === 0 ? COLORS.gray[300] : COLORS.gray[600]} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReorderPage(index, 'down')}
                  disabled={index === pages.length - 1}
                  style={[styles.pageAction, index === pages.length - 1 && styles.pageActionDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={`Move page ${index + 1} later`}
                >
                  <ChevronDown size={20} color={index === pages.length - 1 ? COLORS.gray[300] : COLORS.gray[600]} />
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
            <Text style={styles.addPageText}>{t('upload.addAnotherPage')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Tips */}
        <View style={styles.pagesTips}>
          <Text style={styles.pagesTipsText}>
            Use the arrows to change page order. Pages are combined into a single
            document in the order shown.
          </Text>
        </View>
      </View>
    );
  }

  // Crop state — trim the edges before uploading (TC-MOB-021).
  if (scanState === 'crop' && capturedImage) {
    return (
      <CropEditor
        uri={capturedImage}
        onCancel={() => setScanState('preview')}
        onDone={(croppedUri) => {
          // The crop becomes the new baseline, so switching back to the
          // "Original" enhance mode returns the cropped image rather than
          // silently undoing the crop.
          setCapturedImage(croppedUri);
          setOriginalImage(croppedUri);
          setEnhanceMode('original');
          setScanState('preview');
        }}
      />
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
            <Text style={styles.enhancingText}>{t('upload.enhancing')}</Text>
          </View>
        )}

        <View style={styles.previewOverlay}>
          <View style={styles.previewOverlayText}>
            <Text style={styles.previewTitle}>{t('upload.reviewYourScan')}</Text>
            <Text style={styles.previewText}>
              Make sure the entire notice is visible and the text is readable.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cropFab}
            onPress={() => setScanState('crop')}
            disabled={isEnhancing}
            accessibilityRole="button"
            accessibilityLabel="Crop scan"
          >
            <CropIcon size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Enhancement Options */}
        <View style={styles.enhanceContainer}>
          <Text style={styles.enhanceLabel}>{t('upload.enhance')}</Text>
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
            <Text style={styles.previewButtonText}>{t('upload.retake')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.previewButton, styles.previewButtonPrimary]}
            onPress={handleUpload}
            disabled={isEnhancing}
          >
            <Check size={24} color={COLORS.white} />
            <Text style={styles.previewButtonText}>{t('upload.upload')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Only the camera state reaches this point, so blurring the tab means the
  // viewfinder is not visible — unmount it rather than hold the camera session
  // open behind another tab (TC-MOB-084, TC-MOB-085). Remounting on return is
  // fast, and the OS shuts the camera indicator off in between.
  if (!isCameraActive) {
    return <View style={styles.container} />;
  }

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
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </Animated.View>

          {/* Aiming guidance. Static by design — see the note above. */}
          <View style={styles.edgeStatus}>
            <Text style={styles.edgeStatusText}>
              Position the notice within the frame, then tap to capture
            </Text>
          </View>

          {/* Multi-page badge */}
          {shouldShowPagesBadge(isMultiPageMode, pages.length) && (
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
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => confirmDiscard(exitScanner)}
              accessibilityRole="button"
              accessibilityLabel="Cancel scanning"
            >
              <X size={24} color={COLORS.white} />
            </TouchableOpacity>

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
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handleImport}
              accessibilityRole="button"
              accessibilityLabel="Choose a file from photos or files"
            >
              <FolderOpen size={24} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.captureButtonBusy]}
              onPress={handleCapture}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Capture page"
              accessibilityState={{ disabled: isCapturing }}
            >
              <View style={styles.captureButtonInner} />
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
            <Text style={styles.tipText}>• Tap the page counter to review your pages</Text>
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

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
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
  // Dimmed while a capture is in flight, so a blocked second tap looks
  // blocked rather than ignored.
  captureButtonBusy: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.xxl,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewOverlayText: {
    flex: 1,
  },
  // Icon-only so the bottom row keeps just two full-width actions; a third
  // labelled button overflowed and clipped "Upload".
  cropFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
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
  pendingIcon: {
    backgroundColor: COLORS.warning,
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
  errorHint: {
    color: COLORS.gray[500],
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
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
