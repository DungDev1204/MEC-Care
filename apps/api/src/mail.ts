import nodemailer from 'nodemailer';
import type { Config } from './config.js';
import { HttpError } from './validation.js';

export type SendOtp = (email: string, code: string) => Promise<void>;
export function otpSender(config: Config): SendOtp {
  const smtp = config.smtp;
  const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure,
    requireTLS: !smtp.secure, auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
  return async (email, code) => {
    if (config.review || !smtp.user || !smtp.pass || !smtp.from) throw new HttpError(503, 'Máy chủ chưa bật gửi email xác minh. Vui lòng liên hệ quản trị viên.');
    try {
      await transport.sendMail({ from: { name: 'Clienté', address: smtp.from }, to: email,
        subject: 'Mã xác minh đăng ký Clienté',
        text: `Mã xác minh đăng ký của bạn: ${code}\nMã có hiệu lực 10 phút. Không chia sẻ mã này.\nNếu bạn không đăng ký, hãy bỏ qua email này.` });
    } catch { throw new HttpError(503, 'Chưa gửi được email xác minh. Vui lòng thử lại sau.'); }
  };
}
