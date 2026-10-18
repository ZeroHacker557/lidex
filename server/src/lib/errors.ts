export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Avtorizatsiya talab qilinadi') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = "Ruxsat yo'q") => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Topilmadi') => new HttpError(404, msg, 'not_found');
export const conflict = (msg: string) => new HttpError(409, msg, 'conflict');
