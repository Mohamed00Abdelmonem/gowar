import type { AuthSession, DemoRole } from '../types';
import { normalizeEgyptPhone } from '../utils/phone';

/**
 * FRONTEND-ONLY DEMO AUTHENTICATION SERVICE
 * -----------------------------------------
 * Isolated behind a clean service interface so a real backend (JWT / OAuth /
 * session cookies) can replace this module later. In production, credential
 * verification, role authorization, and store scoping MUST be enforced server-side.
 */

const AUTH_STORAGE_KEY = 'gowar_demo_auth_session_v1';
const REGISTERED_MERCHANTS_KEY = 'gowar_demo_registered_merchants_v1';

export interface DemoCredentialAccount {
  id: string;
  role: DemoRole;
  phone: string;
  email: string;
  password: string;
  nameAr: string;
  nameEn: string;
  merchantId?: string;
  merchantCode?: string;
  storeNameAr?: string;
  storeNameEn?: string;
}

export const DEMO_ACCOUNTS: DemoCredentialAccount[] = [
  {
    id: 'usr-merchant-001',
    role: 'merchant',
    phone: '+201011111111',
    email: 'ahmed@gowar.demo',
    password: 'Gowar@123',
    nameAr: 'أحمد عبد الرحمن',
    nameEn: 'Ahmed Abdelrahman',
    merchantId: 'store-albaraka',
    merchantCode: 'merchant_001',
    storeNameAr: 'ماركت البركة',
    storeNameEn: 'Al-Baraka Market',
  },
  {
    id: 'usr-merchant-002',
    role: 'merchant',
    phone: '+201022222222',
    email: 'nour@gowar.demo',
    password: 'Gowar@123',
    nameAr: 'محمود النور',
    nameEn: 'Mahmoud El-Nour',
    merchantId: 'store-elnour',
    merchantCode: 'merchant_002',
    storeNameAr: 'سوبر ماركت النور',
    storeNameEn: 'El-Nour Supermarket',
  },
  {
    id: 'usr-admin-001',
    role: 'admin',
    phone: '+201000000001',
    email: 'admin@gowar.demo',
    password: 'Admin@123',
    nameAr: 'مدير منصة جوار',
    nameEn: 'Gowar Super Admin',
  },
];

function getRegisteredDemoAccounts(): DemoCredentialAccount[] {
  try {
    const raw = localStorage.getItem(REGISTERED_MERCHANTS_KEY);
    return raw ? (JSON.parse(raw) as DemoCredentialAccount[]) : [];
  } catch {
    return [];
  }
}

export function registerDemoMerchantAccount(account: DemoCredentialAccount): void {
  try {
    const list = getRegisteredDemoAccounts().filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase()
    );
    localStorage.setItem(REGISTERED_MERCHANTS_KEY, JSON.stringify([...list, account]));
  } catch {
    // Ignore storage quota errors
  }
}

export function getDemoSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || (parsed.role !== 'merchant' && parsed.role !== 'admin')) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loginWithDemoCredentials(
  phoneOrEmail: string,
  password: string,
  expectedRole: DemoRole
): { ok: true; session: AuthSession } | { ok: false; errorAr: string; errorEn: string } {
  const normalizedPhone = normalizeEgyptPhone(phoneOrEmail);
  const cleanEmail = phoneOrEmail.trim().toLowerCase();
  const match = [...DEMO_ACCOUNTS, ...getRegisteredDemoAccounts()].find(
    (acc) =>
      ((normalizedPhone.ok && acc.phone === normalizedPhone.value) ||
        acc.email.toLowerCase() === cleanEmail) &&
      acc.password === password
  );

  if (!match) {
    return {
      ok: false,
      errorAr: 'رقم الموبايل أو كلمة المرور غير صحيحة.',
      errorEn: 'Invalid mobile number or password.',
    };
  }

  if (match.role !== expectedRole) {
    return {
      ok: false,
      errorAr:
        expectedRole === 'merchant'
          ? 'هذا الحساب مخصص لإدارة المنصة وليس لبوابة التاجر.'
          : 'هذا الحساب خاص بالتاجر ولا يملك صلاحيات الإدارة.',
      errorEn:
        expectedRole === 'merchant'
          ? 'This account belongs to Admin, not the Merchant Portal.'
          : 'Merchant accounts cannot log into the Admin Portal.',
    };
  }

  const session: AuthSession = {
    role: match.role,
    userId: match.id,
    email: match.email,
    nameAr: match.nameAr,
    nameEn: match.nameEn,
    merchantId: match.merchantId,
    merchantCode: match.merchantCode,
    loggedInAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }

  return { ok: true, session };
}

export function clearDemoSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
