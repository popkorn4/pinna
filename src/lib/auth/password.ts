import bcrypt from "bcryptjs";

// почему cost 12: на современном железе ~250 мс на хеш — медленно для брутфорса,
// но не настолько, чтобы пользователь чувствовал тормоз при логине.
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
