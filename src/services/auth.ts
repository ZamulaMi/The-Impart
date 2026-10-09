// Сервіс для збереження та передачі токена адміністратора
import { formatErrorMessage } from '../utils/errors';

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
    const payload = JSON.stringify({ action: 'login', username, password });
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Спочатку пробуємо прямий ендпоінт /api/auth
    let res = await fetch('/api/auth', {
      method: 'POST',
      headers,
      body: payload,
    }).catch(() => null);

    // Якщо 404 або статус не ok (наприклад, специфіка роутингу Vercel), пробуємо альтернативні шляхи
    if (!res || !res.ok) {
      const alt1 = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers,
        body: payload,
      }).catch(() => null);
      if (alt1 && alt1.ok) {
        res = alt1;
      } else {
        const alt2 = await fetch('/api/auth/login', {
          method: 'POST',
          headers,
          body: payload,
        }).catch(() => null);
        if (alt2 && alt2.ok) {
          res = alt2;
        } else if (alt1) {
          res = alt1;
        }
      }
    }

    if (!res) {
      return {
        success: false,
        error: "Не вдалося з'єднатися з сервером авторизації",
      };
    }

    let data: any = {};
    const text = await res.text().catch(() => '');
    try {
      data = JSON.parse(text);
    } catch {
      if (text && text.toLowerCase().includes('server error')) {
        data = { error: 'Помилка з\'єднання з сервером. Спробуйте ще раз або оновіть сторінку.' };
      } else {
        data = { error: text || 'Помилка відповіді сервера' };
      }
    }

    if (res.ok && data.success && data.token) {
      setAuthToken(data.token, remember);
      if (data.user?.username) {
        setAdminUser(data.user.username, remember);
      }
      return { success: true };
    }

    return {
      success: false,
      error: formatErrorMessage(data.error || data, 'Помилка входу в систему'),
      remainingAttempts: data.remainingAttempts,
      locked: data.locked,
      retryAfter: data.retryAfter,
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatErrorMessage(err, "Не вдалося зв'язатися з сервером"),
    };
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const headers = {
      Accept: 'application/json',
      ...getAuthHeaders(),
    };

    let res = await fetch(`/api/auth?action=verify&_t=${Date.now()}`, {
      method: 'GET',
      headers,
    }).catch(() => null);

    if (!res || res.status === 404) {
      res = await fetch(`/api/auth/verify?_t=${Date.now()}`, {
        method: 'GET',
        headers,
      }).catch(() => null);
    }

    if (res && res.ok) {
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
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    };
    const body = JSON.stringify({ action: 'logout' });

    let res = await fetch('/api/auth', {
      method: 'POST',
      headers,
      body,
    }).catch(() => null);

    if (!res || res.status === 404) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers,
        body,
      }).catch(() => null);
    }
  } catch {}
  clearAuthToken();
}

export interface AdminAccountInfo {
  authenticated: boolean;
  username: string;
  isCustom?: boolean;
}

export async function getAdminAccountInfo(): Promise<AdminAccountInfo | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const headers = {
      Accept: 'application/json',
      ...getAuthHeaders(),
    };

    let res = await fetch(`/api/auth?action=verify&_t=${Date.now()}`, {
      method: 'GET',
      headers,
    }).catch(() => null);

    if (!res || res.status === 404) {
      res = await fetch(`/api/auth/verify?_t=${Date.now()}`, {
        method: 'GET',
        headers,
      }).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.authenticated) {
        return {
          authenticated: true,
          username: data.user?.username || getAdminUser() || 'admin',
          isCustom: data.user?.isCustom,
        };
      }
    }
  } catch {}

  return null;
}

export async function changeAdminCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    };
    const body = JSON.stringify({
      action: 'change_credentials',
      currentPassword,
      newUsername,
      newPassword,
    });

    let res = await fetch('/api/auth', {
      method: 'POST',
      headers,
      body,
    }).catch(() => null);

    if (!res || res.status === 404) {
      res = await fetch('/api/auth/change-credentials', {
        method: 'POST',
        headers,
        body,
      }).catch(() => null);
    }

    if (!res) {
      return { success: false, error: "Не вдалося з'єднатися з сервером" };
    }

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      if (data.token) {
        setAuthToken(data.token, true);
      }
      if (data.user?.username) {
        setAdminUser(data.user.username, true);
      }
      return { success: true, message: data.message || 'Логін та пароль успішно оновлено' };
    }

    return { success: false, error: formatErrorMessage(data.error || data, 'Не вдалося оновити облікові дані') };
  } catch (err: any) {
    return { success: false, error: formatErrorMessage(err, 'Помилка виконання запиту') };
  }
}

export async function resetAdminCredentials(
  currentPassword: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    };
    const body = JSON.stringify({
      action: 'reset_credentials',
      currentPassword,
    });

    let res = await fetch('/api/auth', {
      method: 'POST',
      headers,
      body,
    }).catch(() => null);

    if (!res || res.status === 404) {
      res = await fetch('/api/auth/reset-credentials', {
        method: 'POST',
        headers,
        body,
      }).catch(() => null);
    }

    if (!res) {
      return { success: false, error: "Не вдалося з'єднатися з сервером" };
    }

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      if (data.token) {
        setAuthToken(data.token, true);
      }
      if (data.user?.username) {
        setAdminUser(data.user.username, true);
      }
      return { success: true, message: data.message || 'Облікові дані скинуто до стандартних' };
    }

    return { success: false, error: formatErrorMessage(data.error || data, 'Не вдалося скинути облікові дані') };
  } catch (err: any) {
    return { success: false, error: formatErrorMessage(err, 'Помилка виконання запиту') };
  }
}
