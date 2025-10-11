declare module "nodemailer" {
  export type SendMailOptions = Record<string, any>;
  export type SentMessageInfo = { messageId?: string } & Record<string, any>;

  export interface Transporter {
    sendMail(mail: SendMailOptions): Promise<SentMessageInfo>;
  }

  export function createTransport(options: any): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
