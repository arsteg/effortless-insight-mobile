/**
 * Upload/Scan Screen
 * Camera-based document scanning and upload
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, Camera, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Camera as CameraIcon, Image as ImageIcon, Zap, ZapOff, RotateCcw, Check, X } from 'lucide-react-native';
import { useUploadNotice } from '../../src/hooks/useNotices';
import { LoadingSpinner, Button } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

type ScanState = 'camera' | 'preview' | 'uploading' | 'success' | 'error';

export default function UploadScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>('camera');
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useUploadNotice();

  // Request camera permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (photo) {
          setCapturedImage(photo.uri);
          setScanState('preview');
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
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      setScanState('preview');
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScanState('camera');
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!capturedImage) return;

    setScanState('uploading');

    try {
      await uploadMutation.mutateAsync({
        file: {
          uri: capturedImage,
          type: 'image/jpeg',
          name: `notice_${Date.now()}.jpg`,
        },
        onProgress: setUploadProgress,
      });

      setScanState('success');
    } catch (error) {
      console.error('Upload failed:', error);
      setScanState('error');
    }
  };

  const handleDone = () => {
    handleRetake();
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
        <Button
          title="Open Settings"
          onPress={() => {
            // Platform-specific settings link would go here
          }}
          variant="primary"
        />
      </View>
    );
  }

  // Uploading state
  if (scanState === 'uploading') {
    return (
      <View style={styles.uploadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.uploadingTitle}>Uploading Notice</Text>
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
          Your notice has been uploaded and is being processed. You'll receive a notification once
          the AI analysis is complete.
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

  // Preview state
  if (scanState === 'preview' && capturedImage) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />

        <View style={styles.previewOverlay}>
          <Text style={styles.previewTitle}>Review Your Scan</Text>
          <Text style={styles.previewText}>
            Make sure the entire notice is visible and the text is readable.
          </Text>
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewButton} onPress={handleRetake}>
            <RotateCcw size={24} color={COLORS.white} />
            <Text style={styles.previewButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.previewButton, styles.previewButtonPrimary]}
            onPress={handleUpload}
          >
            <Check size={24} color={COLORS.white} />
            <Text style={styles.previewButtonText}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera state
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraFacing}
        flash={flashMode}
      >
        {/* Document Frame Guide */}
        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.frameText}>Position the notice within the frame</Text>
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

            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <RotateCcw size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Bottom Row */}
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.galleryButton} onPress={handleGalleryPick}>
              <ImageIcon size={24} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <View style={styles.placeholderButton} />
          </View>
        </View>
      </CameraView>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Tips for best results:</Text>
        <Text style={styles.tipText}>• Use good lighting</Text>
        <Text style={styles.tipText}>• Keep the document flat</Text>
        <Text style={styles.tipText}>• Avoid shadows and glare</Text>
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
    width: '100%',
    aspectRatio: 0.7,
    maxHeight: '70%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  frameText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginTop: SPACING.lg,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    paddingTop: SPACING.xxl,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  captureButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: COLORS.white,
    borderWidth: 3,
    borderColor: COLORS.gray[300],
  },
  placeholderButton: {
    width: 50,
    height: 50,
  },
  tipsContainer: {
    backgroundColor: COLORS.gray[900],
    padding: SPACING.md,
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
    paddingTop: SPACING.xxl,
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
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
