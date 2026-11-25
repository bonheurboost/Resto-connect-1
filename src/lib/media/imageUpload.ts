export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Lit un fichier image local sélectionné par l'utilisateur et le convertit en Data URL base64
 * utilisable directement dans l'aperçu, la vitrine publique et l'administration.
 */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const allowedMime = /^image\/(png|jpeg|jpg|webp|gif)$/i;
    if (!allowedMime.test(file.type)) {
      reject(new Error('Format non supporté. Utilisez PNG, JPG, WEBP ou GIF.'));
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      reject(new Error('Image trop lourde (maximum 5 Mo).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Impossible de lire le fichier image."));
      }
    };
    reader.onerror = () => reject(new Error("Erreur lors de l'importation de l'image."));
    reader.readAsDataURL(file);
  });
}
