/**
 * MultiPageScanner Component
 *
 * Multi-page document scanning with:
 * - Add multiple pages to a single document
 * - Preview and reorder pages
 * - Delete individual pages
 * - Generate PDF from multiple images
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Plus,
  X,
  Check,
  Trash2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  FileText,
  Camera,
} from 'lucide-react-native';
import { DocumentScanner } from './DocumentScanner';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md * 3) / 4;

interface ScannedPage {
  id: string;
  uri: string;
  thumbnailUri?: string;
  timestamp: number;
}

interface MultiPageScannerProps {
  onComplete: (pages: ScannedPage[]) => void;
  onCancel: () => void;
  maxPages?: number;
  minPages?: number;
}

type ScannerState = 'scanning' | 'preview' | 'reviewing';

export function MultiPageScanner({
  onComplete,
  onCancel,
  maxPages = 50,
  minPages = 1,
}: MultiPageScannerProps) {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [scannerState, setScannerState] = useState<ScannerState>('scanning');
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate unique ID for each page
  const generatePageId = () => `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create thumbnail for preview
  const createThumbnail = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      return uri;
    }
  };

  // Handle new page capture
  const handlePageCapture = useCallback(async (imageUri: string) => {
    if (pages.length >= maxPages) {
      Alert.alert(
        'Maximum Pages Reached',
        `You can only scan up to ${maxPages} pages per document.`
      );
      return;
    }

    setIsProcessing(true);

    try {
      const thumbnailUri = await createThumbnail(imageUri);

      const newPage: ScannedPage = {
        id: generatePageId(),
        uri: imageUri,
        thumbnailUri,
        timestamp: Date.now(),
      };

      setPages((prev) => [...prev, newPage]);
      setScannerState('preview');
    } catch (error) {
      console.error('Failed to process page:', error);
      Alert.alert('Error', 'Failed to process the scanned page. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [pages.length, maxPages]);

  // Add another page
  const handleAddPage = () => {
    setScannerState('scanning');
  };

  // Delete a page
  const handleDeletePage = (pageId: string) => {
    Alert.alert(
      'Delete Page',
      'Are you sure you want to delete this page?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPages((prev) => prev.filter((p) => p.id !== pageId));
            setSelectedPageIndex(null);
          },
        },
      ]
    );
  };

  // Move page up in order
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const newPages = [...prev];
      [newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]];
      return newPages;
    });
    setSelectedPageIndex(index - 1);
  };

  // Move page down in order
  const handleMoveDown = (index: number) => {
    if (index >= pages.length - 1) return;
    setPages((prev) => {
      const newPages = [...prev];
      [newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]];
      return newPages;
    });
    setSelectedPageIndex(index + 1);
  };

  // Retake a specific page
  const handleRetakePage = (index: number) => {
    setSelectedPageIndex(index);
    setScannerState('scanning');
  };

  // Complete scanning and return pages
  const handleComplete = () => {
    if (pages.length < minPages) {
      Alert.alert(
        'Not Enough Pages',
        `Please scan at least ${minPages} page${minPages > 1 ? 's' : ''}.`
      );
      return;
    }
    onComplete(pages);
  };

  // Cancel and confirm if pages exist
  const handleCancel = () => {
    if (pages.length > 0) {
      Alert.alert(
        'Discard Scanned Pages?',
        `You have ${pages.length} scanned page${pages.length > 1 ? 's' : ''}. Are you sure you want to discard them?`,
        [
          { text: 'Keep Scanning', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onCancel },
        ]
      );
    } else {
      onCancel();
    }
  };

  // Scanner state - show camera
  if (scannerState === 'scanning') {
    return (
      <DocumentScanner
        onCapture={(uri) => {
          // If retaking a specific page, replace it
          if (selectedPageIndex !== null) {
            createThumbnail(uri).then((thumbnailUri) => {
              setPages((prev) => {
                const newPages = [...prev];
                newPages[selectedPageIndex] = {
                  ...newPages[selectedPageIndex],
                  uri,
                  thumbnailUri,
                  timestamp: Date.now(),
                };
                return newPages;
              });
              setSelectedPageIndex(null);
              setScannerState('preview');
            });
          } else {
            handlePageCapture(uri);
          }
        }}
        onCancel={() => {
          if (pages.length > 0) {
            setScannerState('preview');
            setSelectedPageIndex(null);
          } else {
            handleCancel();
          }
        }}
        autoCapture={true}
        showEdgeGuide={true}
      />
    );
  }

  // Preview/Review state - show scanned pages
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <X size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <FileText size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>
            {pages.length} Page{pages.length !== 1 ? 's' : ''} Scanned
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleComplete}
          style={[styles.headerButton, styles.doneButton]}
          disabled={pages.length < minPages}
        >
          <Check size={20} color={COLORS.white} />
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Page Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageGrid}>
          {pages.map((page, index) => (
            <TouchableOpacity
              key={page.id}
              style={[
                styles.pageCard,
                selectedPageIndex === index && styles.pageCardSelected,
              ]}
              onPress={() => setSelectedPageIndex(selectedPageIndex === index ? null : index)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: page.thumbnailUri || page.uri }}
                style={styles.pageThumbnail}
                resizeMode="cover"
              />
              <View style={styles.pageNumber}>
                <Text style={styles.pageNumberText}>{index + 1}</Text>
              </View>

              {/* Page Actions (when selected) */}
              {selectedPageIndex === index && (
                <View style={styles.pageActions}>
                  <TouchableOpacity
                    style={styles.pageActionButton}
                    onPress={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ChevronUp
                      size={18}
                      color={index === 0 ? COLORS.gray[400] : COLORS.white}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pageActionButton}
                    onPress={() => handleMoveDown(index)}
                    disabled={index === pages.length - 1}
                  >
                    <ChevronDown
                      size={18}
                      color={index === pages.length - 1 ? COLORS.gray[400] : COLORS.white}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pageActionButton}
                    onPress={() => handleRetakePage(index)}
                  >
                    <RotateCcw size={18} color={COLORS.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pageActionButton, styles.deleteButton]}
                    onPress={() => handleDeletePage(page.id)}
                  >
                    <Trash2 size={18} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Add Page Button */}
          {pages.length < maxPages && (
            <TouchableOpacity style={styles.addPageCard} onPress={handleAddPage}>
              <Plus size={32} color={COLORS.gray[400]} />
              <Text style={styles.addPageText}>Add Page</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Tips:</Text>
          <Text style={styles.instructionText}>• Tap a page to select it</Text>
          <Text style={styles.instructionText}>• Use arrows to reorder pages</Text>
          <Text style={styles.instructionText}>• Tap "Done" when finished</Text>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButton} onPress={handleAddPage}>
          <Camera size={20} color={COLORS.primary} />
          <Text style={styles.bottomButtonText}>Add Page</Text>
        </TouchableOpacity>

        <View style={styles.pageCount}>
          <Text style={styles.pageCountText}>
            {pages.length} / {maxPages} pages
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.bottomButton, styles.completeButton]}
          onPress={handleComplete}
          disabled={pages.length < minPages}
        >
          <Check size={20} color={COLORS.white} />
          <Text style={styles.completeButtonText}>Upload</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
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
  headerButton: {
    padding: SPACING.sm,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  doneText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  pageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  pageCard: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE * 1.4,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    position: 'relative',
  },
  pageCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  pageThumbnail: {
    width: '100%',
    height: '100%',
  },
  pageNumber: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
  pageActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SPACING.xs,
    justifyContent: 'space-around',
  },
  pageActionButton: {
    padding: SPACING.xs,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.sm,
  },
  addPageCard: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE * 1.4,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  addPageText: {
    color: COLORS.gray[500],
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xs,
  },
  instructions: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
  },
  instructionsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  instructionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  bottomButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  pageCount: {
    alignItems: 'center',
  },
  pageCountText: {
    color: COLORS.gray[500],
    fontSize: FONT_SIZES.sm,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default MultiPageScanner;
