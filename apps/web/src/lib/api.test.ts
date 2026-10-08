import { afterEach, expect, it, vi } from 'vitest';
import { request } from './api';

afterEach(() => vi.unstubAllGlobals());
it('shows the password validation error instead of the generic registration message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Dữ liệu chưa hợp lệ.', errors: { password: ['Mật khẩu cần ít nhất 6 ký tự.'] } }), { status: 400 })));
  await expect(request('/auth/register', { method: 'POST' })).rejects.toThrow('Mật khẩu cần ít nhất 6 ký tự.');
});
