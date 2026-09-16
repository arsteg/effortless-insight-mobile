/**
 * Opening a downloaded notice document in a real viewer (TC-MOB-038).
 *
 * Android was handing the presigned URL to `WebBrowser.openBrowserAsync`, which
 * opens a Chrome Custom Tab. Custom Tabs cannot render a PDF: Chrome passes it
 * to the download manager and leaves an empty tab behind — the reported
 * "it downloads to the system and the page is blank".
 *
 * iOS does not have this problem. SFSafariViewController renders PDFs inline
 * with pinch-zoom and paging, so that path is deliberately left alone.
 *
 * The fix for Android is to hand the file to whatever PDF viewer the user
 * already has, via an ACTION_VIEW intent. That brings pinch-zoom and page
 * navigation for free, and works on a local file — so a cached document opens
 * offline, which the browser route could never do.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Best-guess MIME type from a file name, for the intent's `type`. */
export function mimeTypeFor(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'webp':
      return 'image/webp';
    default:
      // Let the OS decide rather than asserting a type that could be wrong.
      return '*/*';
  }
}

/** Whether a local file can be opened in a native viewer on this platform. */
export const canOpenLocalDocument = Platform.OS === 'android';

/**
 * Open a local file in the device's own viewer.
 *
 * Returns false when it could not be opened — no PDF viewer installed, the
 * module missing in Expo Go — so the caller can fall back rather than leave the
 * user staring at nothing.
 */
export async function openLocalDocument(
  localUri: string,
  fileName: string
): Promise<boolean> {
  if (!canOpenLocalDocument) return false;

  try {
    // A file:// path cannot be shared with another app on modern Android;
    // it has to be a content:// URI backed by a FileProvider.
    const contentUri = await FileSystem.getContentUriAsync(localUri);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IntentLauncher = require('expo-intent-launcher');

    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      // FLAG_GRANT_READ_URI_PERMISSION — without it the viewer is handed a URI
      // it is not allowed to read, and shows an empty document.
      flags: 1,
      type: mimeTypeFor(fileName),
    });
    return true;
  } catch {
    // No handler for the type, or the module is unavailable.
    return false;
  }
}

/**
 * Offer the file to the share sheet — "save to Files", mail it, and so on.
 *
 * This is the download affordance TC-MOB-038 asks for: the in-app viewer route
 * has no browser chrome of its own to provide one.
 */
export async function shareDocument(localUri: string, fileName: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) return false;

    await Sharing.shareAsync(localUri, {
      mimeType: mimeTypeFor(fileName),
      UTI: fileName.toLowerCase().endsWith('.pdf') ? 'com.adobe.pdf' : 'public.item',
      dialogTitle: fileName,
    });
    return true;
  } catch {
    return false;
  }
}
