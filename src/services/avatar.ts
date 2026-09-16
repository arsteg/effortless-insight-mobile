/**
 * Choosing and uploading the user's avatar (TC-MOB-064).
 *
 * The profile screen showed initials with no way to change them. The web
 * client has always called POST /users/avatar; that endpoint did not exist
 * until now, so this and the web share one contract rather than inventing a
 * second.
 *
 * The image is cropped square and downscaled here rather than server-side: a
 * modern phone camera produces a 4-6MB frame, and an avatar is rendered at
 * about 100px. Uploading the original would cost the user real cellular data
 * for pixels nobody sees.
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/** Stored edge length. Generous for a retina avatar, tiny as a file. */
export const AVATAR_SIZE = 512;

/** Matches the server's allow-list; anything else is rejected there anyway. */
export const AVATAR_MIME = 'image/jpeg';

export type AvatarPickResult =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; source: 'camera' | 'library' };

/**
 * Crop and shrink a picked image to a square avatar.
 *
 * `allowsEditing` already gives a 1:1 crop UI, so this only enforces the size.
 */
async function prepare(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/** Take a new photo. */
export async function takeAvatarPhoto(): Promise<AvatarPickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'permission-denied', source: 'camera' };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    // The square crop the circular frame will mask.
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.length) return { status: 'cancelled' };
  return { status: 'picked', uri: await prepare(result.assets[0].uri) };
}

/** Choose an existing image from the photo library. */
export async function pickAvatarFromLibrary(): Promise<AvatarPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'permission-denied', source: 'library' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.length) return { status: 'cancelled' };
  return { status: 'picked', uri: await prepare(result.assets[0].uri) };
}

/** Why a permission refusal happened, in words the user can act on. */
export function permissionMessage(source: 'camera' | 'library'): string {
  return source === 'camera'
    ? 'Camera access is off. Turn it on in Settings to take a photo.'
    : 'Photo access is off. Turn it on in Settings to choose a picture.';
}
