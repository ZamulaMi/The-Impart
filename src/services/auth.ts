// Сервіс для збереження та передачі токена адміністратора

const STORAGE_KEY = 'impart_admin_token';
const USER_KEY = 'impart_admin_username';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, remember: boolean = true): void {
  try {
    if (remember) {
      localStorage.setItem(STORAGE_KEY, token);
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, token);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {}
}

export function getAdminUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || null;
  } catch {
    return null;
  }
}

export function setAdminUser(username: string, remember: boolean = true): void {
  try {
    if (remember) {
      localStorage.setItem(USER_KEY, username);
    } else {
      sessionStorage.setItem(USER_KEY, username);
    }
  } catch {}
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

export async function loginAdmin(
  username: string,
  password: string,
  remember: boolean = true
): Promise<{
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  locked?: boolean;
  retryAfter?: number;
}> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.token) {
      setAuthToken(data.token, remember);
      if (data.user?.username) {
        setAdminUser(data.user.username, remember);
      }
      return { success: true };
    }

    return {
      success: false,
      error: data.error || 'Помилка входу в систему',
      remainingAttempts: data.remainingAttempts,
      locked: data.locked,
      retryAfter: data.retryAfter,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Не вдалося зв\'язатися з сервером',
    };
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const res = await fetch(`/api/auth/verify?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.authenticated) {
        return true;
      }
    }
  } catch {}

  // Якщо перевірка провалилась — очищуємо прострочений або недійсний токен
  clearAuthToken();
  return false;
}

export async function logoutAdmin(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
    });
  } catch {}
  clearAuthToken();
}
