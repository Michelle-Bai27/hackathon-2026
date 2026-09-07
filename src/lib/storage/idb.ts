const DB_NAME = "lumen-media";
const STORE = "blobs";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putValue(id: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getValue<T>(id: string): Promise<T | null> {
  const db = await openDb();
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

export async function putMedia(id: string, dataUrl: string): Promise<void> {
  await putValue(id, dataUrl);
}

export async function getMedia(id: string): Promise<string | null> {
  const value = await getValue<string | Blob>(id);
  if (!value) return null;
  if (typeof value === "string") return value;
  return blobToDataUrl(value);
}

export async function putOriginalFile(lectureId: string, file: File | Blob): Promise<void> {
  await putValue(originalKey(lectureId), file);
}

export async function getOriginalFile(lectureId: string): Promise<Blob | null> {
  const value = await getValue<Blob | string>(originalKey(lectureId));
  if (!value) return null;
  if (typeof value === "string") {
    const res = await fetch(value);
    return res.blob();
  }
  return value;
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function originalKey(lectureId: string) {
  return `original:${lectureId}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
