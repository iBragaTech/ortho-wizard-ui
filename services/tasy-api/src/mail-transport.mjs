import nodemailer from "nodemailer";

export class MailFailure extends Error {
  constructor(code, uncertain = false) {
    super("Não foi possível confirmar o envio do e-mail.");
    this.code = code;
    this.uncertain = uncertain;
  }
}

export function createHospitalMailer({
  pool,
  from = "tasy@aebmg.org.br",
  createTransport = nodemailer.createTransport,
}) {
  return async (message) => {
    let connection, transport;
    try {
      // Same credential source as the supplied Python; no IMAP access is needed.
      connection = await pool.getConnection();
      connection.callTimeout = 10000;
      await connection.execute("SET TRANSACTION READ ONLY");
      const result = await connection.execute(
        `SELECT TASY.AEBMG_DECRYPTING_DATA(HEXTORAW(DS_MAIL_ENV)) AS "user",
          TASY.AEBMG_DECRYPTING_DATA(HEXTORAW(DS_KEY_ENV)) AS "pass",
          TASY.AEBMG_DECRYPTING_DATA(HEXTORAW(DS_SERV_ENV)) AS "host",
          TASY.AEBMG_DECRYPTING_DATA(HEXTORAW(DS_DOR_ENV)) AS "port"
         FROM TASY.AEBMG_SRV_INFO WHERE TIPO_SERV=1
           AND LOWER(TASY.AEBMG_DECRYPTING_DATA(HEXTORAW(DS_MAIL_ENV)))=:sender`,
        { sender: from.toLowerCase() },
        { maxRows: 2 },
      );
      if (result.rows.length !== 1) throw new MailFailure("SMTP_CONFIGURATION");
      const credentials = result.rows[0];
      const port = Number(credentials.port);
      if (
        !credentials.host ||
        !credentials.user ||
        !credentials.pass ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
      )
        throw new MailFailure("SMTP_CONFIGURATION");
      transport = createTransport({
        host: credentials.host.trim(),
        port,
        secure: port === 465,
        requireTLS: true,
        auth: { user: credentials.user.trim(), pass: credentials.pass },
        tls: { rejectUnauthorized: true },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } catch {
      throw new MailFailure("SMTP_CONFIGURATION");
    } finally {
      if (connection) {
        await connection.rollback().catch(() => {});
        await connection.close().catch(() => {});
      }
    }
    try {
      await transport.verify();
    } catch {
      transport.close();
      throw new MailFailure("SMTP_CONNECTION");
    }
    try {
      const result = await transport.sendMail({
        ...message,
        from: { name: "Hospital Evangélico • Orçamentos", address: from },
      });
      if (!result.accepted?.length || result.rejected?.length)
        throw new MailFailure("SMTP_REJECTED");
    } catch (error) {
      if (error instanceof MailFailure) throw error;
      // Lost confirmation after DATA is ambiguous: never retry it automatically.
      throw new MailFailure("SMTP_DELIVERY", !(error.responseCode >= 400));
    } finally {
      transport.close();
    }
  };
}
