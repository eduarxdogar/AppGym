export const INBODY_MAX_FILE_BYTES = 7_500_000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function readInbodyFile(file: File): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
  if (!TYPES.includes(mimeType)) throw new Error('Selecciona un reporte PDF o una imagen JPG, PNG o WebP.');
  if (!file.size || file.size > INBODY_MAX_FILE_BYTES) throw new Error('El reporte está vacío o supera el límite de 7,5 MB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No pudimos leer el archivo. Selecciónalo de nuevo.'));
    reader.onabort = () => reject(new Error('La lectura del archivo se canceló. Intenta de nuevo.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.includes(';base64,')) {
        reject(new Error('No pudimos leer el archivo. Selecciónalo de nuevo.'));
        return;
      }
      resolve({ dataUrl: reader.result, base64: reader.result.split(';base64,')[1], mimeType });
    };
    reader.readAsDataURL(file);
  });
}
