import type { CameraView } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export class SelfieError extends Error {}

/** One frame of the live capture, shrunk to what liveness and face matching need. */
export type Frame = { uri: string; base64: string };

/** The steps the customer follows in front of the live camera. */
export type LivenessStep = { key: string; prompt: string; hint: string; holdMs: number };

/**
 * Different poses give frames that differ from each other, which a photo held up to
 * the camera can't do. The last step (looking straight) gives the frame Dojah checks
 * for liveness and matches to the BVN photo.
 */
export const LIVENESS_STEPS: LivenessStep[] = [
  { key: 'blink', prompt: 'Blink slowly', hint: 'Keep your face inside the oval', holdMs: 1800 },
  { key: 'turn', prompt: 'Turn your head slightly to the left', hint: 'Just a little, then hold', holdMs: 2000 },
  { key: 'straight', prompt: 'Look straight at the camera', hint: 'Hold still', holdMs: 1800 },
];

/** Seconds for "position your face" before the first prompt. */
export const SETTLE_MS = 1500;

/** Take one frame from the live camera, silently, and prepare it for upload. */
export async function captureFrame(camera: CameraView): Promise<Frame> {
  const shot = await camera.takePictureAsync({ quality: 0.8, shutterSound: false, exif: false });
  if (!shot?.uri) throw new SelfieError("We couldn't read the camera. Please try again.");
  const context = ImageManipulator.manipulate(shot.uri);
  if (Math.max(shot.width, shot.height) > 960) {
    context.resize(shot.width >= shot.height ? { width: 960, height: null } : { width: null, height: 960 });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new SelfieError("We couldn't read the camera. Please try again.");
  return { uri: saved.uri, base64: saved.base64 };
}
