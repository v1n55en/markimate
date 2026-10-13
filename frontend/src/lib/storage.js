/**
 * Helper storage Markimate dengan migrasi otomatis dari key supermat_* lama.
 * Menjamin user yang login di versi lama tidak ter-logout dan data tetap utuh.
 */

function resolveKeys(key) {
  const str = String(key);
  if (str.startsWith('markimate_')) {
    return {
      newKey: str,
      oldKey: 'supermat_' + str.slice('markimate_'.length)
    };
  }
  if (str.startsWith('supermat_')) {
    return {
      newKey: 'markimate_' + str.slice('supermat_'.length),
      oldKey: str
    };
  }
  return {
    newKey: 'markimate_' + str,
    oldKey: 'supermat_' + str
  };
}

export function getItem(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const { newKey, oldKey } = resolveKeys(key);

    const newVal = window.localStorage.getItem(newKey);
    if (newVal !== null && newVal !== undefined) {
      return newVal;
    }

    // Fallback & migrasi satu kali dari key lama
    const oldVal = window.localStorage.getItem(oldKey);
    if (oldVal !== null && oldVal !== undefined) {
      window.localStorage.setItem(newKey, oldVal);
      window.localStorage.removeItem(oldKey);
      return oldVal;
    }

    return null;
  } catch (err) {
    console.warn('[Storage] Gagal getItem:', err);
    return null;
  }
}

export function setItem(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const { newKey, oldKey } = resolveKeys(key);
    window.localStorage.setItem(newKey, String(value));
    // Bersihkan key lama jika ada untuk mencegah duplikasi
    window.localStorage.removeItem(oldKey);
  } catch (err) {
    console.warn('[Storage] Gagal setItem:', err);
  }
}

export function removeItem(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const { newKey, oldKey } = resolveKeys(key);
    window.localStorage.removeItem(newKey);
    window.localStorage.removeItem(oldKey);
  } catch (err) {
    console.warn('[Storage] Gagal removeItem:', err);
  }
}

export const storage = {
  getItem,
  setItem,
  removeItem
};

export default storage;
