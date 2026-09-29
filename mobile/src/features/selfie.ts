import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export class SelfieError extends Error {}

export type Selfie = { uri: string; base64: string };

/**
 * Take a selfie with the front camera (never from the photo library: it must be the
 * person holding the phone) and shrink it to what face matching needs.
 * Returns null when the customer cancels.
 */
export async function takeSelfie(): Promise<Selfie | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new SelfieError('Camera access is off. Allow it in Settings to take your selfie.');
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const context = ImageManipulator.manipulate(a.uri);
  if (Math.max(a.width, a.height) > 960) {
    context.resize(a.width >= a.height ? { width: 960, height: null } : { width: null, height: 960 });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new SelfieError("We couldn't process that photo. Please try again.");
  return { uri: saved.uri, base64: saved.base64 };
}
